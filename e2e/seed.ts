/**
 * Seed de la base e2e (`mle_e2e` sur le conteneur db-test).
 *
 * Recrée des données minimalistes from scratch à chaque exécution : les factories sont typées
 * sur le schéma Drizzle, et les migrations sont appliquées au démarrage (via setupTestDb) —
 * le seed ne peut donc pas dériver silencieusement du schéma.
 *
 * Lancer via : pnpm e2e:seed (DATABASE_URL_TEST pointe alors vers mle_e2e).
 */
import postgres from 'postgres'
import { createAcademy, createAccommodation, createCity, createDepartment } from '../src/__tests__/fixtures/factories'
import { cleanTables, setupTestDb, teardownTestDb } from '../src/__tests__/helpers/test-db'

const E2E_DB_NAME = 'mle_e2e'
const ADMIN_URL = 'postgres://test:test@localhost:5491/postgres'

/** La liste de recherche filtre par ST_Within(point, boundary) : la ville doit avoir un polygone. */
const square = (lng: number, lat: number, d = 0.05) => ({
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  ],
})

const SAINT_ETIENNE: [number, number] = [4.39, 45.44]
const PARIS: [number, number] = [2.35, 48.85]

async function ensureDatabaseExists() {
  const conn = postgres(ADMIN_URL, { max: 1 })
  const exists = await conn`SELECT 1 FROM pg_database WHERE datname = ${E2E_DB_NAME}`
  if (exists.length === 0) await conn.unsafe(`CREATE DATABASE ${E2E_DB_NAME}`)
  await conn.end()
}

async function seed() {
  await ensureDatabaseExists()
  await setupTestDb()
  await cleanTables()

  const academy = await createAcademy({ name: 'Académie de Lyon', slug: 'academie-de-lyon' })
  const department = await createDepartment({ academyId: academy.id, name: 'Loire', code: '42', slug: 'loire' })
  const city = await createCity({
    departmentId: department.id,
    name: 'Saint-Étienne',
    slug: 'saint-etienne',
    postalCodes: ['42000'],
    popular: true,
    boundary: square(...SAINT_ETIENNE),
  })

  await createAccommodation(
    {
      name: 'Résidence E2E du Centre',
      slug: 'residence-e2e-du-centre',
      published: true,
      cityId: city.id,
      address: '1 place Jean-Jaurès',
      postalCode: '42000',
      geom: { type: 'Point', coordinates: SAINT_ETIENNE },
    },
    [
      { type: 't1', priceMin: 420, priceMax: 520, superficieMin: 18, superficieMax: 25, nbTotal: 30, nbAvailable: 5, colocation: false },
      { type: 't2', priceMin: 580, priceMax: 690, superficieMin: 32, superficieMax: 45, nbTotal: 12, nbAvailable: 2, colocation: false },
    ],
  )

  await createAccommodation(
    {
      name: 'Résidence E2E de la Gare',
      slug: 'residence-e2e-de-la-gare',
      published: true,
      cityId: city.id,
      address: '12 avenue Denfert-Rochereau',
      postalCode: '42000',
      geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] + 0.01, SAINT_ETIENNE[1] + 0.01] },
    },
    // Plus chère que la Résidence du Centre : permet de tester le filtre « Budget maximum »
    // (la liste garde les résidences dont priceMin <= budget choisi).
    [{ type: 't1_bis', priceMin: 650, priceMax: 740, superficieMin: 22, superficieMax: 28, nbTotal: 20, nbAvailable: 8, colocation: false }],
  )

  // Ville sans aucune résidence : pour le scénario « aucun résultat ».
  await createCity({
    departmentId: department.id,
    name: 'Roanne',
    slug: 'roanne',
    postalCodes: ['42300'],
    boundary: square(4.07, 46.03),
  })

  // Hors de Saint-Étienne : ne doit PAS apparaître dans la recherche par ville.
  await createAccommodation(
    {
      name: 'Résidence E2E Hors Ville',
      slug: 'residence-e2e-hors-ville',
      published: true,
      geom: { type: 'Point', coordinates: PARIS },
    },
    [{ type: 't1', priceMin: 800, priceMax: 950, superficieMin: 15, superficieMax: 20, nbTotal: 40, nbAvailable: 1, colocation: false }],
  )

  // Non publiée : ne doit jamais apparaître.
  await createAccommodation({
    name: 'Résidence E2E Non Publiée',
    slug: 'residence-e2e-non-publiee',
    published: false,
    cityId: city.id,
    geom: { type: 'Point', coordinates: SAINT_ETIENNE },
  })

  await teardownTestDb()
  console.log(`Seed e2e OK (base ${E2E_DB_NAME})`)
}

seed().catch((error) => {
  console.error('Échec du seed e2e :', error)
  process.exit(1)
})
