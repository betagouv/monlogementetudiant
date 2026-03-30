import { eq, sql } from 'drizzle-orm'
import { accommodations, cities, departments } from '../../src/server/db/schema'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { fetchCityFromGeoApi, fetchCommunesByDepartment, fillCityFromApi } from '../lib/geocoder'
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
    const existing = await db.select({ id: cities.id }).from(cities).where(eq(cities.name, sc.name)).limit(1)
    if (existing[0]) {
      if (options.verbose) console.log(`  ✓ ${sc.name} existe déjà`)
      result.skipped++
      continue
    }

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
        slug: await findAvailableSlug(generateSlug(sc.name), db, cities),
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

// Arrondissements are handled as merged cities (Paris, Marseille, Lyon) in ensureSpecialCities
function isArrondissement(inseeCode: string): boolean {
  const code = Number.parseInt(inseeCode, 10)
  if (Number.isNaN(code)) return false
  // Paris: 75101-75120, Marseille: 13201-13216, Lyon: 69381-69389
  return (code >= 75101 && code <= 75120) || (code >= 13201 && code <= 13216) || (code >= 69381 && code <= 69389)
}

function findSlugInMemory(baseSlug: string, taken: Set<string>): string {
  if (!taken.has(baseSlug)) return baseSlug
  const prefix = `${baseSlug}-`
  let i = 1
  while (taken.has(`${prefix}${i}`)) i++
  return `${prefix}${i}`
}

async function importAllCommunes(options: SyncOptions, result: SyncResult): Promise<void> {
  // Pre-load reference data
  const deptRows = await db.select({ id: departments.id, code: departments.code }).from(departments)
  const deptMap = new Map(deptRows.map((d) => [d.code, d.id]))

  const inseeRows = await db.select({ inseeCodes: cities.inseeCodes }).from(cities)
  const existingInsee = new Set(inseeRows.flatMap((r) => r.inseeCodes))

  const slugRows = await db.select({ slug: cities.slug }).from(cities)
  const existingSlugs = new Set(slugRows.map((r) => r.slug))

  const deptCodes = Array.from(deptMap.keys()).sort()

  for (let i = 0; i < deptCodes.length; i++) {
    const deptCode = deptCodes[i]
    const deptId = deptMap.get(deptCode)!

    let communes
    try {
      communes = await fetchCommunesByDepartment(deptCode)
    } catch (error) {
      result.errors.push(`Département ${deptCode}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    if (communes.length === 0) {
      if (options.verbose) console.log(`    [${i + 1}/${deptCodes.length}] ${deptCode}: aucune commune retournée`)
      continue
    }

    let created = 0
    for (const commune of communes) {
      if (isArrondissement(commune.code)) continue
      if (existingInsee.has(commune.code)) {
        result.skipped++
        continue
      }

      const baseSlug = generateSlug(commune.nom)
      const slug = findSlugInMemory(baseSlug, existingSlugs)
      existingSlugs.add(slug)
      existingInsee.add(commune.code)

      if (options.dryRun) {
        if (options.verbose) console.log(`      [dry-run] ${commune.nom} (${commune.code})`)
        result.updated++
        created++
        continue
      }

      try {
        await db.insert(cities).values({
          name: commune.nom,
          slug,
          postalCodes: commune.codesPostaux ?? [],
          inseeCodes: [commune.code],
          departmentId: deptId,
          popular: false,
          epciCode: commune.codeEpci ?? null,
          population: commune.population ?? null,
          boundary: commune.contour ? sql`ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${JSON.stringify(commune.contour)})), 4326)` : null,
        })
        result.updated++
        created++
      } catch (error) {
        result.errors.push(`${commune.nom} (${commune.code}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    console.log(`    [${i + 1}/${deptCodes.length}] ${deptCode}: ${created} nouvelles communes`)
  }
}

const command: SyncCommand = {
  name: 'cities',
  description: 'Sync des villes depuis geo.api.gouv.fr',

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    console.log('  🏙️ Vérification des villes spéciales...')
    await ensureSpecialCities(options, result)

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

    console.log('  🔍 Recherche de villes manquantes...')
    const publishedAccommodations = await db
      .select({
        postalCode: accommodations.postalCode,
        city: cities.name,
      })
      .from(accommodations)
      .innerJoin(cities, eq(accommodations.cityId, cities.id))
      .where(eq(accommodations.published, true))

    const existingPostalCodes = new Set((await db.select({ postalCodes: cities.postalCodes }).from(cities)).flatMap((c) => c.postalCodes))

    const missingPostalCodes = new Map<string, string>()
    for (const acc of publishedAccommodations) {
      if (!acc.postalCode || !acc.city || existingPostalCodes.has(acc.postalCode)) continue
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

        // Check if a city with the same INSEE code already exists
        const existingByInsee = await db
          .select({ id: cities.id, name: cities.name, postalCodes: cities.postalCodes })
          .from(cities)
          .where(sql`${apiCity.code} = ANY(${cities.inseeCodes})`)
          .limit(1)

        if (existingByInsee[0]) {
          // City exists — just add the missing postal code
          if (!existingByInsee[0].postalCodes.includes(postalCode)) {
            if (!options.dryRun) {
              await db
                .update(cities)
                .set({ postalCodes: [...existingByInsee[0].postalCodes, postalCode] })
                .where(eq(cities.id, existingByInsee[0].id))
            }
            if (options.verbose) console.log(`    ✓ ${existingByInsee[0].name} — ajout CP ${postalCode}`)
          } else {
            if (options.verbose) console.log(`    ✓ ${existingByInsee[0].name} existe déjà (INSEE ${apiCity.code})`)
          }
          result.skipped++
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
            slug: await findAvailableSlug(generateSlug(apiCity.nom), db, cities),
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

    console.log('  🌍 Import de toutes les communes manquantes...')
    await importAllCommunes(options, result)

    return result
  },
}

export default command
