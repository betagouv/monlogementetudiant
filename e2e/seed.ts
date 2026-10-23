/**
 * Seed de la base e2e (`mle_e2e` sur le conteneur db-test).
 *
 * Recrée des données minimalistes from scratch à chaque exécution : les factories sont typées
 * sur le schéma Drizzle, et les migrations sont appliquées au démarrage (via setupTestDb) —
 * le seed ne peut donc pas dériver silencieusement du schéma.
 *
 * Lancer via : pnpm e2e:seed (env chargé depuis .env.e2e).
 */
import postgres from 'postgres'
import { createAcademy, createAccommodation, createCity, createDepartment, createExternalSource } from '../src/__tests__/fixtures/factories'
import { squareBoundary } from '../src/__tests__/helpers/geo'
import { cleanTables, setupTestDb, teardownTestDb } from '../src/__tests__/helpers/test-db'

const E2E_DB_URL = new URL(process.env.DATABASE_URL_TEST as string)
const E2E_DB_NAME = E2E_DB_URL.pathname.slice(1)
const ADMIN_URL = new URL('/postgres', E2E_DB_URL).toString()

const SAINT_ETIENNE: [number, number] = [4.39, 45.44]
const PARIS: [number, number] = [2.35, 48.85]
const CLERMONT_FERRAND: [number, number] = [3.08, 45.78]

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
    boundary: squareBoundary(...SAINT_ETIENNE),
  })

  await createAccommodation(
    {
      name: 'Résidence E2E du Centre',
      slug: 'residence-e2e-du-centre',
      published: true,
      cityId: city.id,
      address: '1 place Jean-Jaurès',
      postalCode: '42000',
      externalUrl: 'https://bailleur.example.com/residence-du-centre',
      phoneNumber: '0477000000',
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
    [
      {
        type: 't1_bis',
        priceMin: 650,
        priceMax: 740,
        superficieMin: 22,
        superficieMax: 28,
        nbTotal: 20,
        nbAvailable: 8,
        colocation: false,
      },
    ],
  )

  // Sans logement disponible (et sans liste d'attente) : visible par défaut en fin de liste,
  // masquée par le switch « Logements disponibles ».
  await createAccommodation(
    {
      name: 'Résidence E2E Complète',
      slug: 'residence-e2e-complete',
      published: true,
      cityId: city.id,
      geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] - 0.01, SAINT_ETIENNE[1] - 0.01] },
    },
    [{ type: 't1', priceMin: 500, priceMax: 560, superficieMin: 18, superficieMax: 22, nbTotal: 10, nbAvailable: 0, colocation: false }],
  )

  // Avec colocation : pour le filtre « Colocation » (nbColivingApartments > 0, renseigné par l'appelant,
  // non dérivé des typologies).
  await createAccommodation(
    {
      name: 'Résidence E2E Coloc',
      slug: 'residence-e2e-coloc',
      published: true,
      cityId: city.id,
      nbColivingApartments: 2,
      geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] + 0.02, SAINT_ETIENNE[1] - 0.01] },
    },
    [{ type: 't3', priceMin: 450, priceMax: 520, superficieMin: 60, superficieMax: 75, nbTotal: 6, nbAvailable: 2, colocation: true }],
  )

  // Avec logements adaptés PMR : pour le filtre « Adapté PMR » (nbAccessibleApartments > 0).
  await createAccommodation(
    {
      name: 'Résidence E2E PMR',
      slug: 'residence-e2e-pmr',
      published: true,
      cityId: city.id,
      nbAccessibleApartments: 2,
      geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] - 0.02, SAINT_ETIENNE[1] + 0.01] },
    },
    [{ type: 't2', priceMin: 560, priceMax: 620, superficieMin: 30, superficieMax: 40, nbTotal: 8, nbAvailable: 3, colocation: false }],
  )

  // Résidence Crous : exclue de la vue par défaut, visible via le segment « Crous ».
  const crousResidence = await createAccommodation(
    {
      name: 'Résidence E2E Crous',
      slug: 'residence-e2e-crous',
      published: true,
      cityId: city.id,
      geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] + 0.015, SAINT_ETIENNE[1] + 0.015] },
    },
    [{ type: 't1', priceMin: 380, priceMax: 430, superficieMin: 16, superficieMax: 20, nbTotal: 50, nbAvailable: 10, colocation: false }],
  )
  await createExternalSource({ accommodationId: crousResidence.id, source: 'crous' })

  // Remplissage pour dépasser la page de 12 : 1 seul logement disponible chacune, donc toujours
  // après les résidences nommées dans le tri par défaut (priorité puis disponibilités décroissantes).
  for (let i = 1; i <= 8; i++) {
    await createAccommodation(
      {
        name: `Résidence E2E Remplissage ${i}`,
        slug: `residence-e2e-remplissage-${i}`,
        published: true,
        cityId: city.id,
        geom: { type: 'Point', coordinates: [SAINT_ETIENNE[0] + 0.002 * i, SAINT_ETIENNE[1] - 0.002 * i] },
      },
      [
        {
          type: 't1',
          priceMin: 700 + i,
          priceMax: 780 + i,
          superficieMin: 18,
          superficieMax: 24,
          nbTotal: 5,
          nbAvailable: 1,
          colocation: false,
        },
      ],
    )
  }

  // Ville sans aucune résidence : pour le scénario « aucun résultat ».
  await createCity({
    departmentId: department.id,
    name: 'Roanne',
    slug: 'roanne',
    postalCodes: ['42300'],
    boundary: squareBoundary(4.07, 46.03),
  })

  // Ville voisine (~5 km) sans résidence propre : la recherche élargie (+10 km) doit
  // remonter les résidences de Saint-Étienne.
  await createCity({
    departmentId: department.id,
    name: 'Villars',
    slug: 'villars',
    postalCodes: ['42390'],
    boundary: squareBoundary(4.46, 45.47, 0.02),
  })

  // Ville des résidences créées par les tests eux-mêmes (e2e/fixtures.ts) : loin de Saint-Étienne,
  // pour ne pas modifier les résultats attendus par les specs de recherche.
  await createCity({
    departmentId: department.id,
    name: 'Clermont-Ferrand',
    slug: 'clermont-ferrand',
    postalCodes: ['63000'],
    boundary: squareBoundary(...CLERMONT_FERRAND),
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
