import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import SftpClient from 'ssh2-sftp-client'
import { db } from '~/server/db'
import { ensureCity, geocodeAddress } from '~/server/lib/import/geocoder'
import { accommodationAddresses, accommodations, externalSources } from '../../src/server/db/schema'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'
import { pushResidenceEntry } from './import-utils'

const SOURCE = 'fac-habitat'
const OWNER_NAME = 'FAC HABITAT'
const DEFAULT_REMOTE_PATH = '/export/monlogementetudiant.json'

interface FacHabitatResidence {
  id: number | string
  name: string
  address: string
  city: string
  postal_code: string
  marque?: string
  nb_t1?: number
  nb_t1_bis?: number
  nb_t1_prime?: number
  nb_studio_double?: number
  nb_t2?: number
  nb_t2_duplex?: number
  nb_duplex?: number
  nb_t3?: number
  nb_duo?: number
  nb_t4?: number
  nb_t5?: number
  nb_t5_en_colocation?: number
  t1_rent_min?: number
  t1_rent_max?: number
  t1_bis_rent_min?: number
  t1_bis_rent_max?: number
  t1_prime_rent_min?: number
  t1_prime_rent_max?: number
  studio_double_rent_min?: number
  studio_double_rent_max?: number
  t2_rent_min?: number
  t2_rent_max?: number
  t2_duplex_rent_min?: number
  t2_duplex_rent_max?: number
  duplex_rent_min?: number
  duplex_rent_max?: number
  t3_rent_min?: number
  t3_rent_max?: number
  duo_rent_min?: number
  duo_rent_max?: number
  t4_rent_min?: number
  t4_rent_max?: number
  t5_rent_min?: number
  t5_rent_max?: number
  t5_en_colocation_rent_min?: number
  t5_en_colocation_rent_max?: number
  accept_waiting_list?: boolean
  laundry_room?: boolean
  parking?: boolean
  residence_manager?: boolean
  kitchen_type?: string
  refrigerator?: boolean
  bathroom?: string
  nb_t1_available?: number
  nb_t1_bis_available?: number
  nb_t1_prime_available?: number
  nb_studio_double_available?: number
  nb_t2_available?: number
  nb_t2_duplex_available?: number
  nb_duplex_available?: number
  nb_t3_available?: number
  nb_duo_available?: number
  nb_t4_available?: number
  nb_t5_en_colocation_available?: number
  t1_surface_min?: number | null
  t1_surface_max?: number | null
  t1_bis_surface_min?: number | null
  t1_bis_surface_max?: number | null
  t1_prime_surface_min?: number | null
  t1_prime_surface_max?: number | null
  studio_double_surface_min?: number | null
  studio_double_surface_max?: number | null
  t2_surface_min?: number | null
  t2_surface_max?: number | null
  t2_duplex_surface_min?: number | null
  t2_duplex_surface_max?: number | null
  duplex_surface_min?: number | null
  duplex_surface_max?: number | null
  t3_surface_min?: number | null
  t3_surface_max?: number | null
  duo_surface_min?: number | null
  duo_surface_max?: number | null
  t4_surface_min?: number | null
  t4_surface_max?: number | null
  t5_en_colocation_surface_min?: number | null
  t5_en_colocation_surface_max?: number | null
  nb_accessible_apartments?: number
  nb_coliving_apartments?: number
  nb_total_apartments?: number
}

async function downloadFromSftp(verbose?: boolean): Promise<string> {
  const host = process.env.FAC_HABITAT_SFTP_HOST
  const username = process.env.FAC_HABITAT_SFTP_USERNAME
  const port = Number(process.env.FAC_HABITAT_SFTP_PORT) || 22
  const password = process.env.FAC_HABITAT_SFTP_PASSWORD
  const remotePath = process.env.FAC_HABITAT_SFTP_REMOTE_PATH || DEFAULT_REMOTE_PATH

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

function buildTypologyValues(item: FacHabitatResidence) {
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

  const nbT1 = sumIfAny(item.nb_t1)
  const nbT1Bis = sumIfAny(item.nb_t1_bis, item.nb_t1_prime, item.nb_studio_double, item.nb_duplex)
  const nbT2 = sumIfAny(item.nb_t2, item.nb_t2_duplex)
  const nbT3 = sumIfAny(item.nb_t3, item.nb_duo)
  const nbT4 = sumIfAny(item.nb_t4)
  const nbT5 = sumIfAny(item.nb_t5, item.nb_t5_en_colocation)

  const nbT1Available = sumIfAny(item.nb_t1_available)
  const nbT1BisAvailable = sumIfAny(
    item.nb_t1_bis_available,
    item.nb_t1_prime_available,
    item.nb_studio_double_available,
    item.nb_duplex_available,
  )
  const nbT2Available = sumIfAny(item.nb_t2_available, item.nb_t2_duplex_available)
  const nbT3Available = sumIfAny(item.nb_t3_available, item.nb_duo_available)
  const nbT4Available = sumIfAny(item.nb_t4_available)
  const nbT5Available = sumIfAny(item.nb_t5_en_colocation_available)

  return {
    nbT1,
    nbT1Bis,
    nbT2,
    nbT3,
    nbT4,
    nbT5,
    nbT1Available,
    nbT1BisAvailable,
    nbT2Available,
    nbT3Available,
    nbT4Available,
    nbT5Available,
    priceMinT1: minOf(item.t1_rent_min),
    priceMaxT1: maxOf(item.t1_rent_max),
    priceMinT1Bis: minOf(item.t1_bis_rent_min, item.t1_prime_rent_min, item.studio_double_rent_min, item.duplex_rent_min),
    priceMaxT1Bis: maxOf(item.t1_bis_rent_max, item.t1_prime_rent_max, item.studio_double_rent_max, item.duplex_rent_max),
    priceMinT2: minOf(item.t2_rent_min, item.t2_duplex_rent_min),
    priceMaxT2: maxOf(item.t2_rent_max, item.t2_duplex_rent_max),
    priceMinT3: minOf(item.t3_rent_min, item.duo_rent_min),
    priceMaxT3: maxOf(item.t3_rent_max, item.duo_rent_max),
    priceMinT4: minOf(item.t4_rent_min),
    priceMaxT4: maxOf(item.t4_rent_max),
    priceMinT5: minOf(item.t5_rent_min, item.t5_en_colocation_rent_min),
    priceMaxT5: maxOf(item.t5_rent_max, item.t5_en_colocation_rent_max),
    superficieMinT1: minOf(item.t1_surface_min),
    superficieMaxT1: maxOf(item.t1_surface_max),
    superficieMinT1Bis: minOf(item.t1_bis_surface_min, item.t1_prime_surface_min, item.studio_double_surface_min, item.duplex_surface_min),
    superficieMaxT1Bis: maxOf(item.t1_bis_surface_max, item.t1_prime_surface_max, item.studio_double_surface_max, item.duplex_surface_max),
    superficieMinT2: minOf(item.t2_surface_min, item.t2_duplex_surface_min),
    superficieMaxT2: maxOf(item.t2_surface_max, item.t2_duplex_surface_max),
    superficieMinT3: minOf(item.t3_surface_min, item.duo_surface_min),
    superficieMaxT3: maxOf(item.t3_surface_max, item.duo_surface_max),
    superficieMinT4: minOf(item.t4_surface_min),
    superficieMaxT4: maxOf(item.t4_surface_max),
    superficieMinT5: minOf(item.t5_en_colocation_surface_min),
    superficieMaxT5: maxOf(item.t5_en_colocation_surface_max),
  }
}

async function loadResidences(options: ImportOptions): Promise<FacHabitatResidence[]> {
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
    const data: FacHabitatResidence[] = JSON.parse(raw)
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

    const ownerId = await getOrCreateOwner(OWNER_NAME)
    result.ownerName = OWNER_NAME
    result.ownerId = ownerId
    if (options.verbose) console.log(`  Owner FAC HABITAT id=${ownerId}`)

    const residences = await loadResidences(options)
    console.log(`  ${residences.length} résidences chargées`)

    for (let i = 0; i < residences.length; i++) {
      const item = residences[i]
      try {
        const sourceId = String(item.id)
        if (options.verbose) console.log(`  [${i + 1}/${residences.length}] ${item.name} (${sourceId})`)

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId, slug: accommodations.slug })
          .from(externalSources)
          .innerJoin(accommodations, eq(accommodations.id, externalSources.accommodationId))
          .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        const fullAddress = `${item.address}, ${item.postal_code} ${item.city}`
        const geo = await geocodeAddress(fullAddress)
        if (!geo && options.verbose) {
          console.warn(`    ⚠ Geocoding returned null for "${fullAddress}"`)
        }

        let resolvedCity = geo?.city ?? item.city
        const resolvedPostalCode = geo?.postalCode ?? item.postal_code
        let resolvedCityId: number | null = null
        if (resolvedPostalCode && resolvedCity) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCity)
          resolvedCity = cityResult.name
          resolvedCityId = cityResult.id || null
        }

        const typology = buildTypologyValues(item)

        const derived = computeDerivedFields({
          nb_t1: typology.nbT1,
          nb_t1_bis: typology.nbT1Bis,
          nb_t2: typology.nbT2,
          nb_t3: typology.nbT3,
          nb_t4: typology.nbT4,
          nb_t5: typology.nbT5,
          price_min_t1: typology.priceMinT1,
          price_min_t1_bis: typology.priceMinT1Bis,
          price_min_t2: typology.priceMinT2,
          price_min_t3: typology.priceMinT3,
          price_min_t4: typology.priceMinT4,
          price_min_t5: typology.priceMinT5,
        })

        const addressData = {
          address: geo?.address ?? item.address,
          postalCode: resolvedPostalCode,
          cityId: resolvedCityId,
          ...(geo ? { geom: sql`ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)` } : {}),
        }

        const accommodationData = {
          name: item.name,
          residenceType: 'residence-etudiante',
          target_audience: 'etudiants',
          published: true,
          nbT1: typology.nbT1,
          nbT1Bis: typology.nbT1Bis,
          nbT2: typology.nbT2,
          nbT3: typology.nbT3,
          nbT4: typology.nbT4,
          nbT5: typology.nbT5,
          priceMinT1: typology.priceMinT1,
          priceMaxT1: typology.priceMaxT1,
          priceMinT1Bis: typology.priceMinT1Bis,
          priceMaxT1Bis: typology.priceMaxT1Bis,
          priceMinT2: typology.priceMinT2,
          priceMaxT2: typology.priceMaxT2,
          priceMinT3: typology.priceMinT3,
          priceMaxT3: typology.priceMaxT3,
          priceMinT4: typology.priceMinT4,
          priceMaxT4: typology.priceMaxT4,
          priceMinT5: typology.priceMinT5,
          priceMaxT5: typology.priceMaxT5,
          nbT1Available: typology.nbT1Available,
          nbT1BisAvailable: typology.nbT1BisAvailable,
          nbT2Available: typology.nbT2Available,
          nbT3Available: typology.nbT3Available,
          nbT4Available: typology.nbT4Available,
          nbT5Available: typology.nbT5Available,
          superficieMinT1: typology.superficieMinT1,
          superficieMaxT1: typology.superficieMaxT1,
          superficieMinT1Bis: typology.superficieMinT1Bis,
          superficieMaxT1Bis: typology.superficieMaxT1Bis,
          superficieMinT2: typology.superficieMinT2,
          superficieMaxT2: typology.superficieMaxT2,
          superficieMinT3: typology.superficieMinT3,
          superficieMaxT3: typology.superficieMaxT3,
          superficieMinT4: typology.superficieMinT4,
          superficieMaxT4: typology.superficieMaxT4,
          superficieMinT5: typology.superficieMinT5,
          superficieMaxT5: typology.superficieMaxT5,
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
          acceptWaitingList: item.accept_waiting_list ?? null,
          imagesCount: 0,
          externalReference: sourceId,
          ownerId,
          updatedAt: new Date(),
        }

        if (options.dryRun) {
          if (existingSource[0]) {
            if (options.verbose) console.log(`    [dry-run] Mise à jour id=${existingSource[0].accommodationId}`)
            result.updated++
          } else {
            if (options.verbose) console.log(`    [dry-run] Création`)
            result.created++
          }
          continue
        }

        if (existingSource[0]) {
          const accommodationId = existingSource[0].accommodationId
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, accommodationId))
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
