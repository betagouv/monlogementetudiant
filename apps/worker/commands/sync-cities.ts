import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses, accommodations, cities, departments } from '~/server/db/schema'
import { fetchCityFromGeoApi, fetchCommunesByDepartment, fillCityFromApi } from '~/server/lib/import/geocoder'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'
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

// Une ville suffixée (`fontainebleau-1`) reprend le slug de base dès qu'il se libère.
async function reclaimBaseSlugs(options: SyncOptions, result: SyncResult): Promise<void> {
  const rows = await db
    .select({ id: cities.id, name: cities.name, slug: cities.slug })
    .from(cities)
    .orderBy(sql`length(${cities.slug})`, cities.slug)
  const taken = new Set(rows.map((r) => r.slug))

  for (const row of rows) {
    const base = generateSlug(row.name)
    const suffix = row.slug.startsWith(`${base}-`) ? row.slug.slice(base.length + 1) : ''
    if (!/^\d+$/.test(suffix) || taken.has(base)) continue
    console.log(`    ✓ ${row.name} : ${row.slug} → ${base}`)
    taken.delete(row.slug)
    taken.add(base)
    if (!options.dryRun) await db.update(cities).set({ slug: base }).where(eq(cities.id, row.id))
    result.updated++
  }
}

async function reattachAddressesByGeometry(options: SyncOptions, result: SyncResult): Promise<void> {
  const rows = await db.execute<{
    address_id: string
    accommodation: string
    current_city: string
    target_id: string
    target_city: string
  }>(sql`
    SELECT a.id AS address_id, acc.name AS accommodation, cur.name AS current_city,
      (array_agg(c.id))[1] AS target_id, (array_agg(c.name))[1] AS target_city
    FROM ${accommodationAddresses} a
    JOIN ${accommodations} acc ON acc.id = a.accommodation_id
    JOIN ${cities} cur ON cur.id = a.city_id
    JOIN ${cities} c ON ST_Contains(c.boundary, a.geom)
    WHERE a.geom IS NOT NULL
      AND cur.boundary IS NOT NULL
      AND NOT ST_DWithin(cur.boundary::geography, a.geom::geography, 300)
    GROUP BY a.id, acc.name, cur.name
    HAVING count(*) = 1
  `)

  for (const row of rows) {
    console.log(`    ✓ ${row.accommodation} : ${row.current_city} → ${row.target_city}`)
    if (!options.dryRun) {
      await db
        .update(accommodationAddresses)
        .set({ cityId: Number(row.target_id) })
        .where(eq(accommodationAddresses.id, Number(row.address_id)))
    }
    result.updated++
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

    console.log('  🏷️ Réattribution des slugs libérés...')
    await reclaimBaseSlugs(options, result)

    console.log('  📍 Rattachement des résidences à la commune qui contient leur adresse...')
    await reattachAddressesByGeometry(options, result)

    console.log('  🔍 Recherche de villes manquantes...')
    const publishedAccommodations = await db
      .select({
        postalCode: accommodationAddresses.postalCode,
        city: cities.name,
      })
      .from(accommodations)
      .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
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
