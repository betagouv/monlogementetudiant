import { eq } from 'drizzle-orm'
import { accommodations, cities, departments } from '../../src/server/db/schema'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { db } from '../lib/db'
import { fetchCityFromGeoApi, fillCityFromApi } from '../lib/geocoder'
import type { SyncCommand, SyncOptions, SyncResult } from '../types'

// Paris, Marseille, Lyon — arrondissements hardcodés (même données que Django)
const SPECIAL_CITIES = [
  {
    name: 'Paris',
    postalCodes: [
      '75001',
      '75002',
      '75003',
      '75004',
      '75005',
      '75006',
      '75007',
      '75008',
      '75009',
      '75010',
      '75011',
      '75012',
      '75013',
      '75014',
      '75015',
      '75016',
      '75017',
      '75018',
      '75019',
      '75020',
    ],
    inseeCodes: ['75056'],
    departmentCode: '75',
  },
  {
    name: 'Marseille',
    postalCodes: [
      '13001',
      '13002',
      '13003',
      '13004',
      '13005',
      '13006',
      '13007',
      '13008',
      '13009',
      '13010',
      '13011',
      '13012',
      '13013',
      '13014',
      '13015',
      '13016',
    ],
    inseeCodes: ['13055'],
    departmentCode: '13',
  },
  {
    name: 'Lyon',
    postalCodes: ['69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008', '69009'],
    inseeCodes: ['69123'],
    departmentCode: '69',
  },
]

async function ensureSpecialCities(options: SyncOptions, result: SyncResult): Promise<void> {
  for (const sc of SPECIAL_CITIES) {
    const existing = await db.select().from(cities).where(eq(cities.name, sc.name)).limit(1)
    if (existing[0]) {
      if (options.verbose) console.log(`  ✓ ${sc.name} existe déjà`)
      result.skipped++
      continue
    }

    // Find department
    const dept = await db.select().from(departments).where(eq(departments.code, sc.departmentCode)).limit(1)
    if (!dept[0]) {
      result.errors.push(`Département ${sc.departmentCode} introuvable pour ${sc.name}`)
      continue
    }

    if (options.dryRun) {
      if (options.verbose) console.log(`  [dry-run] Création ${sc.name}`)
      result.updated++
      continue
    }

    const [newCity] = await db
      .insert(cities)
      .values({
        name: sc.name,
        slug: generateSlug(sc.name),
        postalCodes: sc.postalCodes,
        inseeCodes: sc.inseeCodes,
        departmentId: dept[0].id,
        popular: true,
      })
      .returning({ id: cities.id })

    await fillCityFromApi(newCity.id)
    if (options.verbose) console.log(`  ✓ ${sc.name} créée`)
    result.updated++
  }
}

const command: SyncCommand = {
  name: 'cities',
  description: 'Sync des villes depuis geo.api.gouv.fr',

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    // Step 1: Ensure Paris/Marseille/Lyon exist
    console.log('  🏙️ Vérification des villes spéciales...')
    await ensureSpecialCities(options, result)

    // Step 2: Update existing cities with API data
    console.log('  🔄 Mise à jour des villes existantes...')
    const allCities = await db.select({ id: cities.id, name: cities.name }).from(cities)
    for (const city of allCities) {
      try {
        if (options.dryRun) {
          result.updated++
          continue
        }
        const updated = await fillCityFromApi(city.id)
        if (updated) {
          result.updated++
          if (options.verbose) console.log(`    ✓ ${city.name}`)
        } else {
          result.skipped++
          if (options.verbose) console.log(`    ⚠ ${city.name} — pas de données API`)
        }
      } catch (error) {
        result.errors.push(`${city.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Step 3: Create missing cities from published accommodations
    console.log('  🔍 Recherche de villes manquantes...')
    const publishedAccommodations = await db
      .select({
        postalCode: accommodations.postalCode,
        city: accommodations.city,
      })
      .from(accommodations)
      .where(eq(accommodations.published, true))

    const existingPostalCodes = new Set((await db.select({ postalCodes: cities.postalCodes }).from(cities)).flatMap((c) => c.postalCodes))

    const missingPostalCodes = new Map<string, string>()
    for (const acc of publishedAccommodations) {
      if (!acc.postalCode || existingPostalCodes.has(acc.postalCode)) continue
      missingPostalCodes.set(acc.postalCode, acc.city)
    }

    if (missingPostalCodes.size > 0) {
      console.log(`  📌 ${missingPostalCodes.size} villes manquantes à créer`)
    }

    for (const [postalCode, cityName] of missingPostalCodes) {
      try {
        const apiCity = await fetchCityFromGeoApi(postalCode, cityName)
        if (!apiCity) {
          result.errors.push(`Ville introuvable pour CP ${postalCode}`)
          continue
        }

        const dept = await db.select().from(departments).where(eq(departments.code, apiCity.codeDepartement)).limit(1)
        if (!dept[0]) {
          result.errors.push(`Département ${apiCity.codeDepartement} introuvable`)
          continue
        }

        if (options.dryRun) {
          if (options.verbose) console.log(`    [dry-run] Création ${apiCity.nom} (${postalCode})`)
          result.updated++
          continue
        }

        const [newCity] = await db
          .insert(cities)
          .values({
            name: apiCity.nom,
            slug: generateSlug(apiCity.nom),
            postalCodes: apiCity.codesPostaux,
            inseeCodes: [apiCity.code],
            departmentId: dept[0].id,
            popular: false,
            epciCode: apiCity.codeEpci ?? null,
            population: apiCity.population ?? null,
          })
          .returning({ id: cities.id })

        await fillCityFromApi(newCity.id)
        if (options.verbose) console.log(`    ✓ ${apiCity.nom} créée`)
        result.updated++
      } catch (error) {
        result.errors.push(`CP ${postalCode}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return result
  },
}

export default command
