import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses, accommodations, cities, departments } from '~/server/db/schema'
import { fetchCommunesByDepartment, fillCityFromApi } from '~/server/lib/import/geocoder'
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

function sameList(a: string[] | null, b: string[]): boolean {
  return (a ?? []).length === b.length && (a ?? []).every((v, i) => v === b[i])
}

// Un appel par département : met à jour les villes existantes (le code INSEE fait foi) et crée les communes absentes.
async function syncCommunesByDepartment(options: SyncOptions, result: SyncResult): Promise<void> {
  const deptRows = await db.select({ id: departments.id, code: departments.code }).from(departments)
  const deptMap = new Map(deptRows.map((d) => [d.code, d.id]))

  const cityRows = await db
    .select({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
      inseeCodes: cities.inseeCodes,
      postalCodes: cities.postalCodes,
      epciCode: cities.epciCode,
      population: cities.population,
    })
    .from(cities)
  const byInsee = new Map<string, (typeof cityRows)[number]>()
  for (const row of cityRows) for (const code of row.inseeCodes ?? []) byInsee.set(code, row)
  const existingSlugs = new Set(cityRows.map((r) => r.slug))

  const deptCodes = Array.from(deptMap.keys()).sort()

  for (let i = 0; i < deptCodes.length; i++) {
    const deptCode = deptCodes[i]
    const deptId = deptMap.get(deptCode)!

    const communes = await fetchCommunesByDepartment(deptCode)
    if (communes.length === 0) {
      result.errors.push(`Département ${deptCode} : aucune commune retournée par l'API`)
      continue
    }

    let created = 0
    let updated = 0
    for (const commune of communes) {
      if (isArrondissement(commune.code)) continue
      const existing = byInsee.get(commune.code)

      if (existing) {
        const updates: Partial<typeof cities.$inferInsert> = {}
        if (commune.nom !== existing.name) {
          existingSlugs.delete(existing.slug)
          updates.name = commune.nom
          updates.slug = findSlugInMemory(generateSlug(commune.nom), existingSlugs)
          existingSlugs.add(updates.slug)
          console.log(`    ↻ ${existing.name} renommée en ${commune.nom} (INSEE ${commune.code})`)
        }
        if (commune.codesPostaux?.length && !sameList(existing.postalCodes, commune.codesPostaux))
          updates.postalCodes = commune.codesPostaux
        if (commune.codeEpci && commune.codeEpci !== existing.epciCode) updates.epciCode = commune.codeEpci
        if (commune.population != null && commune.population !== existing.population) updates.population = commune.population

        if (Object.keys(updates).length === 0) {
          result.skipped++
          continue
        }
        try {
          if (!options.dryRun) await db.update(cities).set(updates).where(eq(cities.id, existing.id))
          result.updated++
          updated++
        } catch (error) {
          result.errors.push(`${commune.nom} (${commune.code}): ${error instanceof Error ? error.message : String(error)}`)
        }
        continue
      }

      const slug = findSlugInMemory(generateSlug(commune.nom), existingSlugs)
      existingSlugs.add(slug)

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

    console.log(`    [${i + 1}/${deptCodes.length}] ${deptCode}: ${updated} mises à jour, ${created} nouvelles communes`)
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

    console.log('  🔄 Mise à jour et import des communes par département...')
    await syncCommunesByDepartment(options, result)

    console.log('  🏷️ Réattribution des slugs libérés...')
    await reclaimBaseSlugs(options, result)

    console.log('  📍 Rattachement des résidences à la commune qui contient leur adresse...')
    await reattachAddressesByGeometry(options, result)

    return result
  },
}

export default command
