import { randomUUID } from 'node:crypto'
import { test as base, expect, type Page } from '@playwright/test'
import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'
import { eq } from 'drizzle-orm'
import { createAccommodation, createOwner, createUser } from '../src/__tests__/fixtures/factories'
import { getTestDb, teardownTestDb } from '../src/__tests__/helpers/test-db'
import { EOwnerContactMode } from '../src/enums/owner-contact-mode'
import { accommodationTypologies } from '../src/server/db/schema/accommodation-typologies'
import { account } from '../src/server/db/schema/auth'
import { cities } from '../src/server/db/schema/cities'

/**
 * Données propres à chaque test (tests parallèles) : chaque compte ou résidence créé ici porte un
 * identifiant unique, en plus du socle commun en lecture seule posé par e2e/seed.ts.
 */

export const PASSWORD = 'Mot-de-passe-e2e-123'

type BailleurPermission = 'manage_residences' | 'manage_applications'

export const uniqueId = () => randomUUID().slice(0, 8)

async function createCredentialUser(fields: Parameters<typeof createUser>[0]) {
  const row = await createUser(fields)
  await getTestDb()
    .insert(account)
    .values({
      id: `account-${row.id}`,
      userId: row.id,
      accountId: row.id,
      issuer: createLocalAccountIssuer('credential'),
      providerId: 'credential',
      password: await hashPassword(PASSWORD),
    })
  return row
}

/** Étudiant au profil complet (sinon la modale « Complétez votre profil » s'ouvre à la connexion). */
export function createStudent(overrides: Partial<Parameters<typeof createUser>[0]> = {}) {
  const id = `e2e-etudiant-${uniqueId()}`
  return createCredentialUser({
    id,
    email: `${id}@e2e.test`,
    name: 'Camille Martin',
    firstname: 'Camille',
    lastname: 'Martin',
    phone: '0612345678',
    birthdate: '2005-03-14',
    scholarshipStatus: 'no',
    ...overrides,
  })
}

/** Compte gestionnaire rattaché à un bailleur qui lui est propre. */
export async function createBailleur({
  permissions = ['manage_residences', 'manage_applications'],
  bailleurRole = 'administrator',
  contactMode = EOwnerContactMode.NONE,
}: {
  permissions?: BailleurPermission[]
  bailleurRole?: 'administrator' | 'gestionnaire'
  contactMode?: EOwnerContactMode
} = {}) {
  const id = `e2e-bailleur-${uniqueId()}`
  const user = await createCredentialUser({
    id,
    email: `${id}@e2e.test`,
    name: 'Dominique Bernard',
    firstname: 'Dominique',
    lastname: 'Bernard',
    role: 'owner',
    bailleurRole,
    bailleurPermissions: permissions,
  })
  const owner = await createOwner({ userId: user.id, name: `Bailleur ${id}`, slug: id, contactMode })
  return { user, owner }
}

/**
 * Résidence propre au test, avec des logements disponibles par défaut. Elle est créée à
 * Clermont-Ferrand (ville seedée à part) pour ne pas modifier les résultats de la recherche à Saint-Étienne.
 */
export async function createResidence(
  overrides: Partial<Parameters<typeof createAccommodation>[0]> = {},
  typologies: Parameters<typeof createAccommodation>[1] = [
    { type: 't1', priceMin: 430, priceMax: 510, superficieMin: 18, superficieMax: 24, nbTotal: 20, nbAvailable: 4, colocation: false },
  ],
) {
  const id = uniqueId()
  return createAccommodation(
    {
      name: `Résidence E2E ${id}`,
      slug: `residence-e2e-${id}`,
      published: true,
      cityId: await getCityId('clermont-ferrand'),
      geom: { type: 'Point', coordinates: [3.08, 45.78] },
      ...overrides,
    },
    typologies,
  )
}

/** Fait remonter la dernière confirmation des disponibilités d'une résidence à la date donnée. */
export async function backdateAvailability(accommodationId: number, date: Date) {
  await getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: date })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))
}

/** Date du jour telle qu'affichée dans l'espace gestionnaire (jj/mm/aaaa, heure de Paris). */
export const todayLabel = () => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(new Date())

export async function getCityId(slug: string) {
  const [city] = await getTestDb().select({ id: cities.id }).from(cities).where(eq(cities.slug, slug))
  return city.id
}

/**
 * Connexion par mot de passe pour tous les rôles. Pour les gestionnaires et admins, l'UI n'offre que
 * le magic link, mais l'endpoint `/sign-in/email` ne filtre pas le rôle : on s'appuie dessus pour
 * éviter de tester l'envoi d'email. Si cet endpoint est un jour restreint aux étudiants, il faudra
 * créer la session directement en base.
 */
export async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password: PASSWORD },
    headers: { origin: process.env.BASE_URL as string },
  })
  expect(response.ok(), `Connexion e2e refusée pour ${email} (${response.status()})`).toBeTruthy()
}

/** Les boutons qui ouvrent une modale DSFR ne réagissent qu'une fois la page hydratée. */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export const test = base.extend<object, { db: ReturnType<typeof getTestDb> }>({
  db: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright exige un objet déstructuré en premier paramètre
    async ({}, use) => {
      await use(getTestDb())
      await teardownTestDb()
    },
    { scope: 'worker', auto: true },
  ],
})

export { expect }
