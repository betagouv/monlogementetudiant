import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import SftpClient from 'ssh2-sftp-client'
import { accommodations, externalSources } from '../../src/server/db/schema'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { ensureCity, geocodeAddress } from '../lib/geocoder'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'

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
  const nbT1 = item.nb_t1 ?? 0
  const nbT1Bis = (item.nb_t1_bis ?? 0) + (item.nb_t1_prime ?? 0) + (item.nb_studio_double ?? 0)
  const nbT2 = (item.nb_t2 ?? 0) + (item.nb_t2_duplex ?? 0) + (item.nb_duplex ?? 0)
  const nbT3 = (item.nb_t3 ?? 0) + (item.nb_duo ?? 0)
  const nbT4 = item.nb_t4 ?? 0
  const nbT5 = (item.nb_t5 ?? 0) + (item.nb_t5_en_colocation ?? 0)

  const minOf = (...vals: (number | undefined | null)[]) => {
    const nums = vals.filter((v): v is number => v != null && v > 0)
    return nums.length > 0 ? Math.round(Math.min(...nums)) : null
  }
  const maxOf = (...vals: (number | undefined | null)[]) => {
    const nums = vals.filter((v): v is number => v != null && v > 0)
    return nums.length > 0 ? Math.round(Math.max(...nums)) : null
  }

  return {
    nbT1: nbT1 || null,
    nbT1Bis: nbT1Bis || null,
    nbT2: nbT2 || null,
    nbT3: nbT3 || null,
    nbT4: nbT4 || null,
    nbT5: nbT5 || null,
    priceMinT1: minOf(item.t1_rent_min),
    priceMaxT1: maxOf(item.t1_rent_max),
    priceMinT1Bis: minOf(item.t1_bis_rent_min, item.t1_prime_rent_min, item.studio_double_rent_min),
    priceMaxT1Bis: maxOf(item.t1_bis_rent_max, item.t1_prime_rent_max, item.studio_double_rent_max),
    priceMinT2: minOf(item.t2_rent_min, item.t2_duplex_rent_min, item.duplex_rent_min),
    priceMaxT2: maxOf(item.t2_rent_max, item.t2_duplex_rent_max, item.duplex_rent_max),
    priceMinT3: minOf(item.t3_rent_min, item.duo_rent_min),
    priceMaxT3: maxOf(item.t3_rent_max, item.duo_rent_max),
    priceMinT4: minOf(item.t4_rent_min),
    priceMaxT4: maxOf(item.t4_rent_max),
    priceMinT5: minOf(item.t5_rent_min, item.t5_en_colocation_rent_min),
    priceMaxT5: maxOf(item.t5_rent_max, item.t5_en_colocation_rent_max),
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
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

    const ownerId = await getOrCreateOwner(OWNER_NAME)
    if (options.verbose) console.log(`  Owner FAC HABITAT id=${ownerId}`)

    const residences = await loadResidences(options)
    console.log(`  ${residences.length} résidences chargées`)

    for (let i = 0; i < residences.length; i++) {
      const item = residences[i]
      try {
        const sourceId = String(item.id)
        if (options.verbose) console.log(`  [${i + 1}/${residences.length}] ${item.name} (${sourceId})`)

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId })
          .from(externalSources)
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

        const accommodationData = {
          name: item.name,
          slug: await findAvailableSlug(generateSlug(item.name), db, accommodations),
          address: geo?.address ?? item.address,
          city: resolvedCity,
          cityId: resolvedCityId,
          postalCode: resolvedPostalCode,
          residenceType: 'residence-etudiante',
          target_audience: 'etudiants',
          published: true,
          ...(geo ? { geom: sql`ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)` } : {}),
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
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, existingSource[0].accommodationId))
          result.updated++
        } else {
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({ ...accommodationData, createdAt: new Date() })
            .returning({ id: accommodations.id })

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source: SOURCE,
            sourceId,
          })
          result.created++
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
