import * as fs from 'node:fs'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  type BailleurPermission,
  DEFAULT_GESTIONNAIRE_PERMISSIONS,
  MAX_BAILLEUR_ADMINISTRATORS,
  sanitizeGestionnairePermissions,
} from '~/server/bailleur/permissions'
import { closeDb, db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { parseCsvContent } from '~/server/lib/import/csv-parser'

export interface DemoteBailleurAdminsOptions {
  file?: string
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  allowNoAdmin?: boolean
  /**
   * Le CSV fait foi dans les deux sens : les lignes « oui » qui ne sont pas encore administratrices
   * le deviennent. Actif par defaut ; `--no-promote` limite le run aux retrogradations.
   */
  promote?: boolean
}

const CHUNK_SIZE = 200

type CsvTarget = {
  email: string
  nomGestionnaire: string
}

type DbUser = {
  id: string
  email: string
  role: string
  ownerId: number | null
  bailleurRole: 'administrator' | 'gestionnaire' | null
  bailleurPermissions: BailleurPermission[]
  contactMode: EOwnerContactMode | null
}

function targetPermissions(u: Pick<DbUser, 'contactMode'>): BailleurPermission[] {
  return sanitizeGestionnairePermissions(DEFAULT_GESTIONNAIRE_PERMISSIONS, u.contactMode ?? EOwnerContactMode.NONE)
}

function hasTargetPermissions(permissions: BailleurPermission[], u: Pick<DbUser, 'contactMode'>): boolean {
  const expected = targetPermissions(u)
  if (permissions.length !== expected.length) return false
  return expected.every((p) => permissions.includes(p))
}

function countByOwner(users: DbUser[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const u of users) {
    const ownerId = u.ownerId as number
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1)
  }
  return counts
}

/**
 * Aligne les roles bailleurs sur un CSV.
 *
 * Le CSV vit hors du depot (il contient des emails nominatifs) et se passe par `--file`. Les lignes dont
 * la colonne `admin` est vide passent en `gestionnaire` avec les permissions dossiers etudiants /
 * disponibilites / residences ; celles marquees « oui » qui ne sont pas encore administratrices le
 * deviennent (permissions remises a [], comme le fait le routeur). `--no-promote` desactive ce second
 * volet et limite le run aux retrogradations.
 */
export async function demoteBailleurAdmins(options: DemoteBailleurAdminsOptions): Promise<void> {
  if (!options.file) {
    throw new Error('Option --file requise : chemin du CSV (colonnes attendues : email, admin)')
  }

  // Promotion active par defaut : le CSV decrit l'etat cible, pas seulement les retrogradations.
  const promote = options.promote !== false

  console.log(`👥 Alignement des roles bailleurs sur le CSV${promote ? '' : ' (retrogradations seules)'}...`)

  try {
    const rows = parseCsvContent(fs.readFileSync(options.file, 'utf-8'), options.limit)
    if (rows.length === 0) throw new Error(`CSV vide ou illisible : ${options.file}`)
    if (!('email' in rows[0]) || !('admin' in rows[0])) {
      throw new Error(`Colonnes attendues « email » et « admin », trouve : ${Object.keys(rows[0]).join(', ')}`)
    }

    // 1. Lecture du CSV. Colonne `admin` vide => a retrograder ; non vide => administrateur attendu.
    const targets = new Map<string, CsvTarget>()
    const keepers = new Map<string, CsvTarget>()
    const doublons: string[] = []
    const valeursInattendues: string[] = []
    let lignesSansEmail = 0

    for (const row of rows) {
      const email = (row.email ?? '').trim().toLowerCase()
      if (!email) {
        lignesSansEmail++
        continue
      }
      const entry: CsvTarget = { email, nomGestionnaire: (row.nom_gestionnaire ?? '').trim() }

      const admin = (row.admin ?? '').trim()
      if (admin !== '') {
        // Defensif : ne jamais retrograder sur un jeton qu'on n'attendait pas.
        if (admin.toLowerCase() !== 'oui') valeursInattendues.push(`${email} → « ${admin} »`)
        if (!keepers.has(email)) keepers.set(email, entry)
        continue
      }

      if (targets.has(email) || keepers.has(email)) {
        doublons.push(email)
        continue
      }
      targets.set(email, entry)
    }

    console.log(`   ${rows.length} ligne(s) lue(s), ${keepers.size} administrateur(s) attendu(s), ${targets.size} a retrograder`)
    if (lignesSansEmail > 0) console.log(`   ⚠ ${lignesSansEmail} ligne(s) sans email ignoree(s)`)
    if (doublons.length > 0) console.log(`   ⚠ ${doublons.length} email(s) en doublon dans le CSV : ${doublons.join(', ')}`)
    if (valeursInattendues.length > 0) {
      console.log(`   ⚠ ${valeursInattendues.length} valeur(s) « admin » inattendue(s), traitees comme « oui » :`)
      for (const v of valeursInattendues) console.log(`      ${v}`)
    }

    if (targets.size === 0 && keepers.size === 0) {
      console.log('\n✓ Aucune ligne exploitable.')
      return
    }

    // 2. Rapprochement avec la base, par email insensible a la casse.
    const emails = [...new Set([...targets.keys(), ...keepers.keys()])]
    const dbUsers: DbUser[] = await db
      .select({
        id: user.id,
        email: user.email,
        role: user.role,
        ownerId: user.ownerId,
        bailleurRole: user.bailleurRole,
        bailleurPermissions: user.bailleurPermissions,
        contactMode: owners.contactMode,
      })
      .from(user)
      .leftJoin(owners, eq(owners.id, user.ownerId))
      .where(inArray(sql`lower(${user.email})`, emails))

    const byEmail = new Map(dbUsers.map((u) => [u.email.trim().toLowerCase(), u]))

    const introuvables: string[] = []
    const nonOwner: string[] = []
    const sansBailleur: string[] = []
    const dejaConformes: string[] = []
    const aRetrograder: DbUser[] = []

    for (const [email, target] of targets) {
      const dbUser = byEmail.get(email)
      if (!dbUser) {
        introuvables.push(email)
        continue
      }
      if (dbUser.role !== 'owner') {
        nonOwner.push(`${email} (role=${dbUser.role})`)
        continue
      }
      if (dbUser.ownerId === null) {
        sansBailleur.push(email)
        continue
      }
      if (dbUser.bailleurRole === 'gestionnaire' && hasTargetPermissions(dbUser.bailleurPermissions ?? [], dbUser)) {
        dejaConformes.push(email)
        continue
      }
      aRetrograder.push(dbUser)
      if (options.verbose) {
        console.log(
          `   ↓ ${email} (bailleur CSV : ${target.nomGestionnaire || '?'}, owner_id=${dbUser.ownerId}, role=${dbUser.bailleurRole})`,
        )
      }
    }

    // 3. Administrateurs attendus : ils doivent exister, et l'etre deja (ou etre promus).
    const keepersIntrouvables = [...keepers.keys()].filter((email) => !byEmail.has(email))
    const aPromouvoir: DbUser[] = []
    for (const [email, keeper] of keepers) {
      const dbUser = byEmail.get(email)
      if (!dbUser || dbUser.bailleurRole === 'administrator') continue
      if (dbUser.role !== 'owner') {
        nonOwner.push(`${email} (role=${dbUser.role}, administrateur attendu)`)
        continue
      }
      if (dbUser.ownerId === null) {
        sansBailleur.push(`${email} (administrateur attendu)`)
        continue
      }
      aPromouvoir.push(dbUser)
      if (options.verbose && promote) {
        console.log(`   ↑ ${email} (bailleur CSV : ${keeper.nomGestionnaire || '?'}, owner_id=${dbUser.ownerId})`)
      }
    }

    // 4. Rapport de rapprochement, imprime avant le filet de securite : meme si le run est abandonne,
    // l'operateur doit voir pourquoi.
    if (dejaConformes.length > 0) console.log(`  ✓ ${dejaConformes.length} deja conforme(s)`)
    if (introuvables.length > 0) {
      console.log(`  ⚠ ${introuvables.length} email(s) a retrograder absent(s) de la base :`)
      for (const e of introuvables) console.log(`     ${e}`)
    }
    if (keepersIntrouvables.length > 0) {
      console.log(`  ⚠ ${keepersIntrouvables.length} administrateur(s) attendu(s) absent(s) de la base :`)
      for (const e of keepersIntrouvables) console.log(`     ${e} (bailleur CSV : ${keepers.get(e)?.nomGestionnaire || '?'})`)
      console.log('     → le CSV et cette base ne decrivent pas le meme etat (base locale en retard sur la prod ?)')
    }
    if (aPromouvoir.length > 0) {
      const verbe = promote ? 'a promouvoir administrateur' : 'attendu(s) administrateur mais pas administrateur en base'
      console.log(`  ${promote ? '↑' : '⚠'} ${aPromouvoir.length} compte(s) ${verbe} :`)
      for (const u of aPromouvoir) console.log(`     ${u.email} (owner_id=${u.ownerId}, role actuel : ${u.bailleurRole ?? 'aucun'})`)
      if (!promote) console.log("     → --no-promote : ils restent en l'etat, retirez l'option pour les promouvoir")
    }
    if (nonOwner.length > 0) {
      console.log(`  ⚠ ${nonOwner.length} compte(s) ignore(s) (role != owner) :`)
      for (const e of nonOwner) console.log(`     ${e}`)
    }
    if (sansBailleur.length > 0) {
      console.log(`  ⚠ ${sansBailleur.length} compte(s) ignore(s) (aucun bailleur rattache) :`)
      for (const e of sansBailleur) console.log(`     ${e}`)
    }

    const promotions = promote ? aPromouvoir : []

    // 5. Filet de securite : on projette l'etat final par bailleur avant d'ecrire quoi que ce soit.
    // Aucun bailleur ne doit finir sans administrateur, ni au-dela du plafond si on y promeut quelqu'un.
    const ownerIds = [...new Set([...aRetrograder, ...promotions].map((u) => u.ownerId as number))]
    if (ownerIds.length > 0) {
      const currentAdmins = await db
        .select({ ownerId: user.ownerId, administratorCount: sql<number>`count(*)::int` })
        .from(user)
        .where(and(inArray(user.ownerId, ownerIds), eq(user.role, 'owner'), eq(user.bailleurRole, 'administrator')))
        .groupBy(user.ownerId)

      // Requete a part : le group-by ci-dessus ne remonte que les bailleurs qui ont deja un
      // administrateur, or ce sont justement les autres qu'il faut savoir nommer dans l'abandon.
      const ownerRows = await db.select({ id: owners.id, name: owners.name }).from(owners).where(inArray(owners.id, ownerIds))

      const ownerNames = new Map(ownerRows.map((o) => [o.id, o.name]))
      const currentByOwner = new Map(currentAdmins.map((o) => [o.ownerId as number, o.administratorCount]))
      const demotedByOwner = countByOwner(aRetrograder.filter((u) => u.bailleurRole === 'administrator'))
      const promotedByOwner = countByOwner(promotions)

      const projections = ownerIds.map((ownerId) => {
        const actuel = currentByOwner.get(ownerId) ?? 0
        const promus = promotedByOwner.get(ownerId) ?? 0
        return {
          ownerId,
          name: ownerNames.get(ownerId) ?? `owner_id=${ownerId}`,
          actuel,
          promus,
          projete: actuel - (demotedByOwner.get(ownerId) ?? 0) + promus,
        }
      })

      const orphelins = projections.filter((p) => p.projete <= 0)
      if (orphelins.length > 0) {
        console.error(`\n❌ ${orphelins.length} bailleur(s) se retrouveraient sans administrateur :`)
        for (const o of orphelins) console.error(`   owner_id=${o.ownerId} — ${o.name} — ${o.actuel} administrateur(s), tous retrogrades`)
        if (!options.allowNoAdmin) {
          throw new Error(
            'Abandon : corrigez le CSV pour conserver au moins un administrateur par bailleur (ou forcez avec --allow-no-admin)',
          )
        }
        console.error('   ⚠ --allow-no-admin : on applique quand meme.')
      }

      // Le plafond ne bloque que si on promeut : une retrogradation seule ne peut qu'ameliorer un
      // bailleur historiquement au-dessus de la limite.
      const depassements = projections.filter((p) => p.promus > 0 && p.projete > MAX_BAILLEUR_ADMINISTRATORS)
      if (depassements.length > 0) {
        console.error(`\n❌ ${depassements.length} bailleur(s) depasseraient ${MAX_BAILLEUR_ADMINISTRATORS} administrateurs :`)
        for (const d of depassements) {
          console.error(`   owner_id=${d.ownerId} — ${d.name} — ${d.actuel} actuel(s), ${d.promus} promu(s) → ${d.projete}`)
        }
        throw new Error(`Abandon : le CSV porterait des bailleurs au-dela de ${MAX_BAILLEUR_ADMINISTRATORS} administrateurs`)
      }
    }

    // 6. Ecriture.
    const prefix = options.dryRun ? '  [dry-run]' : ' '
    if (!options.dryRun) {
      // Les permissions posees dependent du parcours du bailleur : on regroupe par jeu de
      // permissions plutot que d'ecrire la meme valeur pour tout le monde.
      const parJeu = new Map<string, DbUser[]>()
      for (const u of aRetrograder) {
        const key = targetPermissions(u).join(',')
        const bucket = parJeu.get(key)
        if (bucket) bucket.push(u)
        else parJeu.set(key, [u])
      }
      for (const [, groupe] of parJeu) {
        const permissions = targetPermissions(groupe[0])
        for (let i = 0; i < groupe.length; i += CHUNK_SIZE) {
          const chunk = groupe.slice(i, i + CHUNK_SIZE)
          await db
            .update(user)
            .set({ bailleurRole: 'gestionnaire', bailleurPermissions: permissions, updatedAt: new Date() })
            .where(
              inArray(
                user.id,
                chunk.map((u) => u.id),
              ),
            )
        }
      }
      for (let i = 0; i < promotions.length; i += CHUNK_SIZE) {
        const chunk = promotions.slice(i, i + CHUNK_SIZE)
        // Invariant du routeur : un administrateur a toutes les permissions implicitement, la colonne est videe.
        await db
          .update(user)
          .set({ bailleurRole: 'administrator', bailleurPermissions: [], updatedAt: new Date() })
          .where(
            inArray(
              user.id,
              chunk.map((u) => u.id),
            ),
          )
      }
    }

    console.log(`\n${prefix} ${aRetrograder.length} compte(s) retrograde(s) en gestionnaire`)
    // `manage_applications` n'est posee que si le bailleur a choisi un parcours de candidature.
    console.log(`${prefix} permissions posees : ${DEFAULT_GESTIONNAIRE_PERMISSIONS.join(', ')} (selon le parcours du bailleur)`)
    if (promote) console.log(`${prefix} ${promotions.length} compte(s) promu(s) administrateur (permissions remises a [])`)
    if (options.dryRun) console.log('\n  Relancez avec --apply pour ecrire en base.')
  } finally {
    await closeDb()
  }
}
