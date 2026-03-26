import { eq } from 'drizzle-orm'
import { accommodations } from '../../src/server/db/schema/accommodations'
import { cities } from '../../src/server/db/schema/cities'
import { closeDb, db } from '../lib/db'

const BASE_PATH = '/trouver-un-logement-etudiant/ville'

interface HealthcheckOptions {
  verbose?: boolean
  fetch?: boolean
  baseUrl?: string
}

export async function healthcheck(options: HealthcheckOptions) {
  const baseUrl = options.baseUrl || 'http://localhost:3000'

  console.log('🏥 Healthcheck des résidences publiées...\n')

  const rows = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      city: accommodations.city,
      cityId: accommodations.cityId,
      citySlug: cities.slug,
      cityName: cities.name,
    })
    .from(accommodations)
    .leftJoin(cities, eq(accommodations.cityId, cities.id))
    .where(eq(accommodations.published, true))

  let ok = 0
  let warnings = 0
  let errors = 0
  const issues: string[] = []

  for (const row of rows) {
    const checks: string[] = []

    // Check 1: city_id is set
    if (!row.cityId) {
      checks.push(`city_id NULL (city text: "${row.city}")`)
      warnings++
    }

    // Check 2: city has a slug (needed for URL resolution)
    if (row.cityId && !row.citySlug) {
      checks.push(`ville id=${row.cityId} sans slug`)
      errors++
    }

    // Check 3: accommodation has a slug
    if (!row.slug) {
      checks.push('slug manquant')
      errors++
    }

    // Check 4: city name consistency
    if (row.cityId && row.cityName && row.city !== row.cityName) {
      checks.push(`nom incohérent: accommodation.city="${row.city}" vs city.name="${row.cityName}"`)
      if (options.verbose) warnings++
    }

    // Build expected URL
    const cityPart = row.cityName || row.city || null
    const url = cityPart ? `${BASE_PATH}/${encodeURIComponent(cityPart)}/${row.slug}` : null

    if (!cityPart) {
      checks.push("pas de ville pour construire l'URL")
      errors++
    }

    // Optional: HTTP fetch
    if (options.fetch && url) {
      try {
        const response = await fetch(`${baseUrl}${url}`, { method: 'HEAD', redirect: 'follow' })
        if (!response.ok) {
          checks.push(`HTTP ${response.status} sur ${url}`)
          errors++
        }
      } catch (err) {
        checks.push(`fetch error: ${err instanceof Error ? err.message : String(err)}`)
        errors++
      }
    }

    if (checks.length > 0) {
      issues.push(`  #${row.id} ${row.name} (${row.slug}): ${checks.join(' | ')}`)
      if (options.verbose) {
        console.log(`  ⚠ #${row.id} ${row.name}`)
        for (const c of checks) console.log(`      → ${c}`)
      }
    } else {
      ok++
      if (options.verbose) {
        console.log(`  ✓ #${row.id} ${row.name} → ${url}`)
      }
    }
  }

  console.log(`\n📊 Résultat: ${rows.length} résidences publiées`)
  console.log(`  ✅ OK: ${ok}`)
  console.log(`  ⚠️  Warnings: ${warnings}`)
  console.log(`  ❌ Erreurs: ${errors}`)

  if (issues.length > 0) {
    console.log(`\n📋 Détails (${issues.length} résidences avec problèmes):`)
    for (const issue of issues) {
      console.log(issue)
    }
  }

  await closeDb()
  process.exit(errors > 0 ? 1 : 0)
}

export async function healthcheckCities(options: HealthcheckOptions) {
  const baseUrl = options.baseUrl || 'http://localhost:3000'

  console.log('🏙️ Healthcheck des pages villes...\n')

  const rows = await db
    .select({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
    })
    .from(cities)

  let ok = 0
  let errors = 0
  const issues: string[] = []

  for (const row of rows) {
    if (!row.slug) {
      issues.push(`  #${row.id} ${row.name}: slug manquant`)
      errors++
      continue
    }

    const url = `${BASE_PATH}/${row.slug}`

    try {
      const response = await fetch(`${baseUrl}${url}`, { method: 'HEAD', redirect: 'follow' })
      if (!response.ok) {
        issues.push(`  #${row.id} ${row.name}: HTTP ${response.status} → ${url}`)
        errors++
      } else {
        ok++
        if (options.verbose) console.log(`  ✓ ${row.name} → ${url}`)
      }
    } catch (err) {
      issues.push(`  #${row.id} ${row.name}: ${err instanceof Error ? err.message : String(err)} → ${url}`)
      errors++
    }
  }

  console.log(`\n📊 Résultat: ${rows.length} villes`)
  console.log(`  ✅ OK: ${ok}`)
  console.log(`  ❌ Erreurs: ${errors}`)

  if (issues.length > 0) {
    console.log(`\n📋 Détails (${issues.length} villes avec problèmes):`)
    for (const issue of issues) {
      console.log(issue)
    }
  }

  await closeDb()
  process.exit(errors > 0 ? 1 : 0)
}
