import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { user } from '~/server/db/schema'
import { env } from '~/server/env'

// Script one-off dédié au rattrapage des GESTIONNAIRES (role 'owner') dans Brevo.
// Volontairement autonome (n'utilise pas src/server/services/brevo) pour ne pas
// toucher au script/flux existant, et pour exposer finement les codes HTTP Brevo.

interface BackfillOwnersOptions {
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  batchSize?: number
}

// Brevo limite l'API contacts à ~10 req/s : on borne la concurrence et on espace les lots.
const DEFAULT_BATCH_SIZE = 5
const DELAY_BETWEEN_BATCHES_MS = 1100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type BrevoResult = { ok: boolean; status: number; body?: string }

async function upsertOwnerContact(
  email: string,
  { firstname, lastname, createdAt }: { firstname: string; lastname: string; createdAt: Date },
): Promise<BrevoResult> {
  const response = await fetch(env.BREVO_CONTACTS_API_URL, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      updateEnabled: true,
      attributes: {
        COMPTE_ESPACE_GESTIONNAIRE: true,
        DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE: createdAt.toISOString().split('T')[0],
        NOM: lastname,
        PRENOM: firstname,
      },
    }),
  })

  if (response.ok) return { ok: true, status: response.status }
  const body = await response.text()
  return { ok: false, status: response.status, body }
}

export async function backfillBrevoOwners(options: BackfillOwnersOptions = {}): Promise<void> {
  const { dryRun = false, verbose = false, limit, batchSize = DEFAULT_BATCH_SIZE } = options

  console.log(`→ Rattrapage Brevo des gestionnaires${dryRun ? ' (DRY-RUN, aucun appel Brevo)' : ''}`)

  try {
    const query = db
      .select({
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.role, 'owner'))

    const owners = limit ? await query.limit(limit) : await query
    console.log(`→ ${owners.length} gestionnaires à traiter`)

    let synced = 0
    let failed = 0
    const errors: string[] = []
    // Répartition de TOUS les codes Brevo (succès + erreurs) pour observer les soucis d'upload.
    const statusCounts = new Map<number | string, number>()
    const bump = (status: number | string) => statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)

    const processOne = async (o: (typeof owners)[number]): Promise<void> => {
      const date = (o.createdAt ?? new Date()).toISOString().split('T')[0]

      if (dryRun) {
        if (verbose) console.log(`  [dry-run] ${o.email} (${o.firstname} ${o.lastname}) date=${date}`)
        synced++
        return
      }

      try {
        const result = await upsertOwnerContact(o.email, {
          firstname: o.firstname,
          lastname: o.lastname,
          createdAt: o.createdAt ?? new Date(),
        })
        bump(result.status)
        if (result.ok) {
          synced++
          if (verbose) console.log(`  ✓ ${o.email} [Brevo ${result.status}]`)
        } else {
          failed++
          errors.push(`${o.email} [${result.status}]: ${result.body ?? ''}`)
          console.error(`  ✗ ${o.email} [Brevo ${result.status}]: ${result.body ?? ''}`)
        }
      } catch (error) {
        failed++
        bump('network')
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${o.email} [network]: ${message}`)
        console.error(`  ✗ ${o.email} [network]: ${message}`)
      }
    }

    for (let i = 0; i < owners.length; i += batchSize) {
      const batch = owners.slice(i, i + batchSize)
      await Promise.all(batch.map(processOne))

      const done = Math.min(i + batchSize, owners.length)
      console.log(`  … ${done}/${owners.length} traités`)

      if (!dryRun && done < owners.length) await sleep(DELAY_BETWEEN_BATCHES_MS)
    }

    console.log(`\n✓ Terminé : ${synced} synchronisés, ${failed} en échec`)

    if (statusCounts.size > 0) {
      const breakdown = [...statusCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => `${status} → ${count}`)
        .join(', ')
      console.log(`\nRépartition des codes Brevo : ${breakdown}`)
    }

    if (errors.length > 0) {
      console.log('\nDétail des échecs :')
      for (const e of errors) console.log(`  - ${e}`)
    }
  } finally {
    await closeDb()
  }
}
