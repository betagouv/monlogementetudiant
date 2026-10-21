import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import SftpClient from 'ssh2-sftp-client'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { env } from '~/server/env'
import { ensureCity, geocodeAddressVerified } from '~/server/lib/import/geocoder'
import { markAvailabilityImported, resolveImportOwner } from '~/server/lib/import/resolve-owner'
import { syncTypologies, type TypologyDraft, typologyAggregates, typologyDraft } from '~/server/lib/typologies'
import { accommodationAddresses, accommodations, externalSources } from '../../src/server/db/schema'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { pushResidenceEntry } from './import-utils'

const SOURCE = 'fac-habitat'
const OWNER_NAME = 'Fac-Habitat'
const DEFAULT_REMOTE_PATH = '/export/monlogementetudiant.json'

const num = z.number().nullish()
const bool = z.boolean().nullish()

const ZFacHabitatResidence = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  postal_code: z.string(),
  marque: z.string().nullish(),
  nb_t1: num,
  nb_t1_bis: num,
  nb_t1_prime: num,
  nb_studio_double: num,
  nb_t2: num,
  nb_t2_duplex: num,
  nb_duplex: num,
  nb_t3: num,
  nb_duo: num,
  nb_t4: num,
  nb_t5: num,
  nb_t5_en_colocation: num,
  t1_rent_min: num,
  t1_rent_max: num,
  t1_bis_rent_min: num,
  t1_bis_rent_max: num,
  t1_prime_rent_min: num,
  t1_prime_rent_max: num,
  studio_double_rent_min: num,
  studio_double_rent_max: num,
  t2_rent_min: num,
  t2_rent_max: num,
  t2_duplex_rent_min: num,
  t2_duplex_rent_max: num,
  duplex_rent_min: num,
  duplex_rent_max: num,
  t3_rent_min: num,
  t3_rent_max: num,
  duo_rent_min: num,
  duo_rent_max: num,
  t4_rent_min: num,
  t4_rent_max: num,
  t5_rent_min: num,
  t5_rent_max: num,
  t5_en_colocation_rent_min: num,
  t5_en_colocation_rent_max: num,
  accept_waiting_list: bool,
  t1_accept_waiting_list: bool,
  t1_bis_accept_waiting_list: bool,
  t1_prime_accept_waiting_list: bool,
  studio_double_accept_waiting_list: bool,
  t2_accept_waiting_list: bool,
  t2_duplex_accept_waiting_list: bool,
  duplex_accept_waiting_list: bool,
  t3_accept_waiting_list: bool,
  duo_accept_waiting_list: bool,
  t4_accept_waiting_list: bool,
  t5_en_colocation_accept_waiting_list: bool,
  laundry_room: bool,
  parking: bool,
  residence_manager: bool,
  kitchen_type: z.string().nullish(),
  refrigerator: bool,
  bathroom: z.string().nullish(),
  nb_t1_available: num,
  nb_t1_bis_available: num,
  nb_t1_prime_available: num,
  nb_studio_double_available: num,
  nb_t2_available: num,
  nb_t2_duplex_available: num,
  nb_duplex_available: num,
  nb_t3_available: num,
  nb_duo_available: num,
  nb_t4_available: num,
  nb_t5_en_colocation_available: num,
  t1_surface_min: num,
  t1_surface_max: num,
  t1_bis_surface_min: num,
  t1_bis_surface_max: num,
  t1_prime_surface_min: num,
  t1_prime_surface_max: num,
  studio_double_surface_min: num,
  studio_double_surface_max: num,
  t2_surface_min: num,
  t2_surface_max: num,
  t2_duplex_surface_min: num,
  t2_duplex_surface_max: num,
  duplex_surface_min: num,
  duplex_surface_max: num,
  t3_surface_min: num,
  t3_surface_max: num,
  duo_surface_min: num,
  duo_surface_max: num,
  t4_surface_min: num,
  t4_surface_max: num,
  t5_en_colocation_surface_min: num,
  t5_en_colocation_surface_max: num,
  nb_accessible_apartments: num,
  nb_coliving_apartments: num,
  nb_total_apartments: num,
})

type TFacHabitatResidence = z.infer<typeof ZFacHabitatResidence>

async function downloadFromSftp(verbose?: boolean): Promise<string> {
  const {
    FAC_HABITAT_SFTP_HOST: host,
    FAC_HABITAT_SFTP_USERNAME: username,
    FAC_HABITAT_SFTP_PORT: port,
    FAC_HABITAT_SFTP_PASSWORD: password,
  } = env
  const remotePath = env.FAC_HABITAT_SFTP_REMOTE_PATH || DEFAULT_REMOTE_PATH

  if (!host || !username) {
    throw new Error('Variables manquantes : FAC_HABITAT_SFTP_HOST, FAC_HABITAT_SFTP_USERNAME')
  }
  if (!password) {
    throw new Error('Variable manquante : FAC_HABITAT_SFTP_PASSWORD')
  }

  const sftp = new SftpClient()
  const tmpFile = path.join(os.tmpdir(), `fac-habitat-${Date.now()}.json`)

  try {
    if (verbose) console.log(`  SFTP ${username}@${host}:${port}${remotePath}`)

    await sftp.connect({ host, port, username, password })
    await sftp.fastGet(remotePath, tmpFile)

    if (verbose) console.log(`  Fichier téléchargé : ${tmpFile}`)
    return tmpFile
  } catch (error) {
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      // cleanup best-effort
    }
    throw error
  } finally {
    await sftp.end()
  }
}

// FAC-Habitat splits some DB typologies across several source columns (e.g. t1_bis = t1_bis + t1_prime
// + studio_double + duplex). The grouping below maps those source columns onto the DB typology types.
function buildTypologyDrafts(item: TFacHabitatResidence): TypologyDraft[] {
  const sumIfAny = (...vals: (number | undefined | null)[]) => {
    const nums = vals.filter((v): v is number => v != null)
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
  }

  const minOf = (...vals: (number | undefined | null)[]) => {
    const nums = vals.filter((v): v is number => v != null && v > 0)
    return nums.length > 0 ? Math.round(Math.min(...nums)) : null
  }
  const maxOf = (...vals: (number | undefined | null)[]) => {
    const nums = vals.filter((v): v is number => v != null && v > 0)
    return nums.length > 0 ? Math.round(Math.max(...nums)) : null
  }

  const gate = (available: number | undefined | null, acceptsApplications: boolean | undefined | null) =>
    available != null && acceptsApplications === false ? 0 : available

  return [
    typologyDraft('t1', {
      nbTotal: sumIfAny(item.nb_t1),
      nbAvailable: sumIfAny(gate(item.nb_t1_available, item.t1_accept_waiting_list)),
      priceMin: minOf(item.t1_rent_min),
      priceMax: maxOf(item.t1_rent_max),
      superficieMin: minOf(item.t1_surface_min),
      superficieMax: maxOf(item.t1_surface_max),
    }),
    typologyDraft('t1_bis', {
      nbTotal: sumIfAny(item.nb_t1_bis, item.nb_t1_prime, item.nb_studio_double, item.nb_duplex),
      nbAvailable: sumIfAny(
        gate(item.nb_t1_bis_available, item.t1_bis_accept_waiting_list),
        gate(item.nb_t1_prime_available, item.t1_prime_accept_waiting_list),
        gate(item.nb_studio_double_available, item.studio_double_accept_waiting_list),
        gate(item.nb_duplex_available, item.duplex_accept_waiting_list),
      ),
      priceMin: minOf(item.t1_bis_rent_min, item.t1_prime_rent_min, item.studio_double_rent_min, item.duplex_rent_min),
      priceMax: maxOf(item.t1_bis_rent_max, item.t1_prime_rent_max, item.studio_double_rent_max, item.duplex_rent_max),
      superficieMin: minOf(item.t1_bis_surface_min, item.t1_prime_surface_min, item.studio_double_surface_min, item.duplex_surface_min),
      superficieMax: maxOf(item.t1_bis_surface_max, item.t1_prime_surface_max, item.studio_double_surface_max, item.duplex_surface_max),
    }),
    typologyDraft('t2', {
      nbTotal: sumIfAny(item.nb_t2, item.nb_t2_duplex),
      nbAvailable: sumIfAny(
        gate(item.nb_t2_available, item.t2_accept_waiting_list),
        gate(item.nb_t2_duplex_available, item.t2_duplex_accept_waiting_list),
      ),
      priceMin: minOf(item.t2_rent_min, item.t2_duplex_rent_min),
      priceMax: maxOf(item.t2_rent_max, item.t2_duplex_rent_max),
      superficieMin: minOf(item.t2_surface_min, item.t2_duplex_surface_min),
      superficieMax: maxOf(item.t2_surface_max, item.t2_duplex_surface_max),
    }),
    typologyDraft('t3', {
      nbTotal: sumIfAny(item.nb_t3, item.nb_duo),
      nbAvailable: sumIfAny(
        gate(item.nb_t3_available, item.t3_accept_waiting_list),
        gate(item.nb_duo_available, item.duo_accept_waiting_list),
      ),
      priceMin: minOf(item.t3_rent_min, item.duo_rent_min),
      priceMax: maxOf(item.t3_rent_max, item.duo_rent_max),
      superficieMin: minOf(item.t3_surface_min, item.duo_surface_min),
      superficieMax: maxOf(item.t3_surface_max, item.duo_surface_max),
    }),
    typologyDraft('t4', {
      nbTotal: sumIfAny(item.nb_t4),
      nbAvailable: sumIfAny(gate(item.nb_t4_available, item.t4_accept_waiting_list)),
      priceMin: minOf(item.t4_rent_min),
      priceMax: maxOf(item.t4_rent_max),
      superficieMin: minOf(item.t4_surface_min),
      superficieMax: maxOf(item.t4_surface_max),
    }),
    typologyDraft('t5', {
      nbTotal: sumIfAny(item.nb_t5, item.nb_t5_en_colocation),
      nbAvailable: sumIfAny(gate(item.nb_t5_en_colocation_available, item.t5_en_colocation_accept_waiting_list)),
      priceMin: minOf(item.t5_rent_min, item.t5_en_colocation_rent_min),
      priceMax: maxOf(item.t5_rent_max, item.t5_en_colocation_rent_max),
      superficieMin: minOf(item.t5_en_colocation_surface_min),
      superficieMax: maxOf(item.t5_en_colocation_surface_max),
    }),
  ]
}

function acceptsWaitingList(item: TFacHabitatResidence): boolean | null {
  const byType = [
    item.t1_accept_waiting_list,
    item.t1_bis_accept_waiting_list,
    item.t1_prime_accept_waiting_list,
    item.studio_double_accept_waiting_list,
    item.t2_accept_waiting_list,
    item.t2_duplex_accept_waiting_list,
    item.duplex_accept_waiting_list,
    item.t3_accept_waiting_list,
    item.duo_accept_waiting_list,
    item.t4_accept_waiting_list,
    item.t5_en_colocation_accept_waiting_list,
  ].filter((v): v is boolean => v != null)
  return byType.length > 0 ? byType.some(Boolean) : (item.accept_waiting_list ?? null)
}

async function describeChanges(accommodationId: number, drafts: TypologyDraft[], acceptWaitingList: boolean | null): Promise<string[]> {
  const [current] = await db
    .select({ acceptWaitingList: accommodations.acceptWaitingList })
    .from(accommodations)
    .where(eq(accommodations.id, accommodationId))
  const rows = await db.select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, accommodationId))
  const before = new Map(rows.map((r) => [r.type, r]))

  const changes: string[] = []
  if (current?.acceptWaitingList !== acceptWaitingList) {
    changes.push(`liste d'attente : ${current?.acceptWaitingList ?? '∅'} → ${acceptWaitingList ?? '∅'}`)
  }
  for (const draft of drafts) {
    const prev = before.get(draft.type)
    const empty = [draft.nbTotal, draft.nbAvailable, draft.priceMin, draft.priceMax].every((v) => v == null)
    if (empty && !prev) continue
    if (prev?.nbAvailable !== draft.nbAvailable)
      changes.push(`${draft.type} dispo : ${prev?.nbAvailable ?? '∅'} → ${draft.nbAvailable ?? '∅'}`)
    if (prev?.nbTotal !== draft.nbTotal) changes.push(`${draft.type} total : ${prev?.nbTotal ?? '∅'} → ${draft.nbTotal ?? '∅'}`)
  }
  return changes
}

async function loadResidences(options: ImportOptions): Promise<unknown[]> {
  let filePath: string
  let tmpFile = false

  if (options.file) {
    filePath = options.file
  } else {
    filePath = await downloadFromSftp(options.verbose)
    tmpFile = true
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = z.array(z.unknown()).parse(JSON.parse(raw))
    return options.limit ? data.slice(0, options.limit) : data
  } finally {
    if (tmpFile) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // cleanup best-effort
      }
    }
  }
}

const command: ImportCommand = {
  name: 'fac-habitat',
  description: 'Import des résidences FAC HABITAT (SFTP ou fichier local)',

  async execute(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], residences: [] }

    const owner = await resolveImportOwner({ id: options.ownerId, slug: options.ownerSlug, name: OWNER_NAME })
    const ownerId = owner.id
    if (!options.dryRun) await markAvailabilityImported(ownerId)
    result.ownerName = owner.name
    result.ownerId = ownerId
    if (options.verbose) console.log(`  Owner ${owner.name} id=${ownerId}`)

    const residences = await loadResidences(options)
    console.log(`  ${residences.length} résidences chargées`)

    for (let i = 0; i < residences.length; i++) {
      const parsed = ZFacHabitatResidence.safeParse(residences[i])
      if (!parsed.success) {
        const msg = `Ligne ${i + 1} : format invalide (${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join(', ')})`
        result.errors.push(msg)
        console.error(`    ❌ ${msg}`)
        continue
      }
      const item = parsed.data
      try {
        const sourceId = String(item.id)
        if (options.verbose) console.log(`  [${i + 1}/${residences.length}] ${item.name} (${sourceId})`)

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId, slug: accommodations.slug })
          .from(externalSources)
          .innerJoin(accommodations, eq(accommodations.id, externalSources.accommodationId))
          .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        const geo = await geocodeAddressVerified(item.address, item.postal_code, item.city)
        if (!geo && options.verbose) {
          console.warn(`    ⚠ Geocoding returned null for "${item.address}, ${item.postal_code} ${item.city}"`)
        }

        let resolvedCity = geo?.city ?? item.city
        const resolvedPostalCode = geo?.postalCode ?? item.postal_code
        let resolvedCityId: number | null = null
        if (resolvedPostalCode && resolvedCity) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCity)
          resolvedCity = cityResult.name
          resolvedCityId = cityResult.id || null
        }

        const typologyDrafts = buildTypologyDrafts(item)

        const derived = typologyAggregates(typologyDrafts)

        const addressData = {
          address: geo?.address ?? item.address,
          postalCode: resolvedPostalCode,
          cityId: resolvedCityId,
          ...(geo ? { geom: sql`ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)` } : {}),
        }

        const accommodationData = {
          name: item.name,
          residenceType: 'residence-etudiante',
          targetAudience: 'etudiants' as const,
          published: true,
          priceMin: derived.priceMin,
          nbTotalApartments: item.nb_total_apartments ?? derived.nbTotalApartments,
          nbAccessibleApartments: item.nb_accessible_apartments ?? null,
          nbColivingApartments: item.nb_coliving_apartments ?? null,
          laundryRoom: item.laundry_room ?? null,
          parking: item.parking ?? null,
          residenceManager: item.residence_manager ?? null,
          kitchenType: item.kitchen_type ?? null,
          refrigerator: item.refrigerator ?? null,
          bathroom: item.bathroom ?? null,
          acceptWaitingList: acceptsWaitingList(item),
          externalReference: sourceId,
          ownerId,
          updatedAt: new Date(),
        }

        if (options.dryRun) {
          if (existingSource[0]) {
            const changes = await describeChanges(existingSource[0].accommodationId, typologyDrafts, accommodationData.acceptWaitingList)
            if (changes.length > 0) {
              console.log(`  ~ ${item.name} (${sourceId}, id=${existingSource[0].accommodationId})`)
              for (const change of changes) console.log(`      ${change}`)
            } else if (options.verbose) {
              console.log(`    [dry-run] Mise à jour id=${existingSource[0].accommodationId} (aucun changement de dispo)`)
            }
            result.updated++
          } else {
            console.log(`  + ${item.name} (${sourceId}) — création`)
            result.created++
          }
          continue
        }

        if (existingSource[0]) {
          const accommodationId = existingSource[0].accommodationId
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, accommodationId))
          await syncTypologies(db, accommodationId, typologyDrafts)
          await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodationId))
          await db.insert(accommodationAddresses).values({ accommodationId, isMain: true, ...addressData })
          result.updated++
          pushResidenceEntry(result.residences!, {
            name: item.name,
            slug: existingSource[0].slug,
            city: resolvedCity ?? null,
            action: 'updated',
          })
        } else {
          const slug = await findAvailableSlug(generateSlug(item.name), db, accommodations)
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({ ...accommodationData, slug, createdAt: new Date() })
            .returning({ id: accommodations.id })
          await syncTypologies(db, newAccommodation.id, typologyDrafts)

          await db.insert(accommodationAddresses).values({ accommodationId: newAccommodation.id, isMain: true, ...addressData })

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source: SOURCE,
            sourceId,
          })
          result.created++
          pushResidenceEntry(result.residences!, { name: item.name, slug, city: resolvedCity ?? null, action: 'created' })
        }
      } catch (error) {
        const rowNum = i + 1
        const cause = error instanceof Error ? (error as unknown as { cause?: unknown }).cause : null
        const dbError = cause && typeof cause === 'object' && 'message' in cause ? String((cause as { message: string }).message) : null
        const rawMessage = error instanceof Error ? error.message : String(error)
        const cleanMessage = rawMessage.replace(/Failed query:[\s\S]*/i, '').trim()
        const displayError = dbError || cleanMessage || rawMessage

        const rowContext = [
          item.address ? `address="${item.address}"` : null,
          item.city ? `city="${item.city}"` : null,
          item.postal_code ? `postal_code="${item.postal_code}"` : null,
          item.nb_total_apartments != null ? `nb_total=${item.nb_total_apartments}` : null,
        ]
          .filter(Boolean)
          .join(', ')

        const msg = `Ligne ${rowNum} - ${item.name} (${item.id}): ${displayError}`
        result.errors.push(msg)
        console.error(`    ❌ ${msg}`)
        console.error(`       Contexte: ${rowContext}`)
        if (options.verbose) {
          console.error(`       Message complet: ${rawMessage.slice(0, 500)}`)
        }
      }
    }

    return result
  },
}

export default command
