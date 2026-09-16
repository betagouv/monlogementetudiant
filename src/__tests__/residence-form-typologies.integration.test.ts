import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { ZUpdateResidence } from '../schemas/accommodations/update-residence'
import { accommodationTypologies } from '../server/db/schema/accommodation-typologies'
import { accommodations } from '../server/db/schema/accommodations'
import { typologyFormDefaults } from '../utils/typology-form-defaults'
import { createOwner, createUser } from './fixtures/factories'
import { ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'
import { loadTypologies } from './helpers/typologies'

// Aller-retour complet du formulaire de résidence : colonnes en base -> valeurs par défaut RHF
// -> validation Zod -> mutation bailleur.update -> colonnes en base.
//
// Les colonnes numériques de `accommodation_typology` sont toutes nullables (imports partiels,
// saisie en plusieurs fois) : un NULL ne doit pas être prérempli à 0, ce qui déclencherait les
// bornes de ZTypology et rendrait le formulaire insoumettable.

const FULL = {
  priceMin: 400,
  priceMax: 600,
  superficieMin: 15,
  superficieMax: 25,
  nbTotal: 10,
  nbAvailable: 5,
  colocation: false,
}

let ownerSuffix = 0

async function createResidence(typologies: Array<{ type: 't1' | 't2' | 't3' | 't4' } & Record<string, unknown>>) {
  ownerSuffix += 1
  await createOwner({ name: `Owner ${ownerSuffix}`, slug: `owner-form-${ownerSuffix}`, userId: 'test-owner-id' })
  const { slug } = await ownerCaller.bailleur.create({
    name: `Résidence ${ownerSuffix}`,
    addresses: [{ address: `${ownerSuffix} rue des Tests`, city: 'Paris', postalCode: '75001' }],
    externalUrl: 'https://example.com',
    published: true,
    typologies: typologies as never,
  })
  return slug
}

async function accommodationBySlug(slug: string) {
  const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.slug, slug))
  return row
}

/** Rejoue exactement ce que fait la page : lecture des lignes -> objet indexé -> valeurs du formulaire. */
async function formDefaults(slug: string) {
  const acc = await accommodationBySlug(slug)
  return typologyFormDefaults(await loadTypologies(acc.id))
}

/** Force les colonnes d'une typologie, pour simuler des données héritées d'un import partiel. */
async function forceTypologyColumns(slug: string, type: string, columns: Record<string, number | null>) {
  const acc = await accommodationBySlug(slug)
  await getTestDb()
    .update(accommodationTypologies)
    .set(columns)
    .where(and(eq(accommodationTypologies.accommodationId, acc.id), eq(accommodationTypologies.type, type as never)))
}

const ALL_NULL_COLUMNS = {
  priceMin: null,
  priceMax: null,
  superficieMin: null,
  superficieMax: null,
  nbTotal: null,
  nbAvailable: null,
}

describe('formulaire résidence — typologies renseignées en base', () => {
  beforeEach(async () => {
    await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  })

  it('préremplit le formulaire avec les valeurs de la base', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])

    expect(await formDefaults(slug)).toEqual([{ type: 't1', ...FULL }])
  })

  it('réenregistre sans rien modifier (aller-retour idempotent)', async () => {
    const slug = await createResidence([
      { type: 't1', ...FULL },
      { type: 't3', ...FULL, priceMin: 800, priceMax: 900, nbTotal: 4, nbAvailable: 0, colocation: true },
    ])

    const before = await formDefaults(slug)
    await ownerCaller.bailleur.update({ slug, typologies: before as never })

    expect(await formDefaults(slug)).toEqual(before)
  })

  it('recalcule les agrégats du parent après réenregistrement', async () => {
    const slug = await createResidence([
      { type: 't1', ...FULL, priceMin: 400, priceMax: 600, nbTotal: 10, nbAvailable: 4 },
      { type: 't3', ...FULL, priceMin: 800, priceMax: 1000, nbTotal: 2, nbAvailable: 1 },
    ])

    await ownerCaller.bailleur.update({ slug, typologies: (await formDefaults(slug)) as never })

    const acc = await accommodationBySlug(slug)
    expect(acc.nbTotalApartments).toBe(12)
    expect(acc.priceMin).toBe(400)
    expect(acc.priceMax).toBe(1000)
    expect(acc.nbAvailableApartments).toBe(5)
  })
})

describe('formulaire résidence — typologies NULL en base', () => {
  beforeEach(async () => {
    await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  })

  it('affiche des champs vides et non des 0 quand toutes les colonnes sont NULL', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])
    await forceTypologyColumns(slug, 't1', ALL_NULL_COLUMNS)

    expect(await formDefaults(slug)).toEqual([
      {
        type: 't1',
        priceMin: undefined,
        priceMax: undefined,
        superficieMin: undefined,
        superficieMax: undefined,
        nbTotal: undefined,
        nbAvailable: undefined,
        colocation: false,
      },
    ])
  })

  it('reste soumettable : la validation Zod passe sur une résidence entièrement NULL', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])
    await forceTypologyColumns(slug, 't1', ALL_NULL_COLUMNS)

    const result = ZUpdateResidence.safeParse({ typologies: await formDefaults(slug) })
    expect(result.success).toBe(true)
  })

  it('conserve les NULL en base après un réenregistrement sans saisie', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])
    await forceTypologyColumns(slug, 't1', ALL_NULL_COLUMNS)

    await ownerCaller.bailleur.update({ slug, typologies: (await formDefaults(slug)) as never })

    const acc = await accommodationBySlug(slug)
    const typos = await loadTypologies(acc.id)
    expect(typos.t1).toEqual({
      priceMin: null,
      priceMax: null,
      superficieMin: null,
      superficieMax: null,
      nbTotal: null,
      nbAvailable: null,
      colocation: false,
    })
  })

  it('laisse les agrégats du parent à NULL plutôt qu’à 0 quand aucune donnée n’existe', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])
    await forceTypologyColumns(slug, 't1', ALL_NULL_COLUMNS)

    await ownerCaller.bailleur.update({ slug, typologies: (await formDefaults(slug)) as never })

    const acc = await accommodationBySlug(slug)
    expect(acc.nbTotalApartments).toBeNull()
    expect(acc.priceMin).toBeNull()
    expect(acc.priceMax).toBeNull()
  })

  it('préserve les valeurs connues d’une typologie partiellement renseignée', async () => {
    const slug = await createResidence([{ type: 't2', ...FULL }])
    await forceTypologyColumns(slug, 't2', { superficieMin: null, superficieMax: null, nbAvailable: null })

    const defaults = await formDefaults(slug)
    expect(defaults[0]).toMatchObject({ priceMin: 400, priceMax: 600, nbTotal: 10, superficieMin: undefined, nbAvailable: undefined })

    await ownerCaller.bailleur.update({ slug, typologies: defaults as never })

    const typos = await loadTypologies((await accommodationBySlug(slug)).id)
    expect(typos.t2).toMatchObject({ priceMin: 400, nbTotal: 10, superficieMin: null, nbAvailable: null })
  })

  it('n’écrase pas les autres typologies quand l’une d’elles est vide', async () => {
    const slug = await createResidence([
      { type: 't1', ...FULL },
      { type: 't4', ...FULL, priceMin: 900, priceMax: 1200 },
    ])
    await forceTypologyColumns(slug, 't1', ALL_NULL_COLUMNS)

    await ownerCaller.bailleur.update({ slug, typologies: (await formDefaults(slug)) as never })

    const typos = await loadTypologies((await accommodationBySlug(slug)).id)
    expect(typos.t1?.priceMin).toBeNull()
    expect(typos.t4?.priceMin).toBe(900)
    expect(typos.t4?.superficieMin).toBe(15)
  })
})

describe('formulaire résidence — champs omis (undefined) et valeur 0', () => {
  beforeEach(async () => {
    await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  })

  it('persiste NULL et non 0 pour les champs absents de la soumission', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])

    // Le formulaire n'envoie pas les clés des champs laissés vides (setValueAs renvoie undefined).
    await ownerCaller.bailleur.update({ slug, typologies: [{ type: 't1', colocation: false }] as never })

    const typos = await loadTypologies((await accommodationBySlug(slug)).id)
    expect(typos.t1).toEqual({
      priceMin: null,
      priceMax: null,
      superficieMin: null,
      superficieMax: null,
      nbTotal: null,
      nbAvailable: null,
      colocation: false,
    })
  })

  it('distingue une valeur renseignée à 0 d’une valeur absente', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])

    await ownerCaller.bailleur.update({
      slug,
      typologies: [{ type: 't1', priceMin: 0, priceMax: 0, nbTotal: 3, nbAvailable: 0, colocation: false }] as never,
    })

    const typos = await loadTypologies((await accommodationBySlug(slug)).id)
    expect(typos.t1?.priceMin).toBe(0)
    expect(typos.t1?.nbAvailable).toBe(0)
    expect(typos.t1?.superficieMin).toBeNull()

    // Et au rechargement de la page, les 0 restent affichés comme des 0.
    const [reloaded] = await formDefaults(slug)
    expect(reloaded.priceMin).toBe(0)
    expect(reloaded.nbAvailable).toBe(0)
    expect(reloaded.superficieMin).toBeUndefined()
  })

  it('agrège correctement quand une typologie sur deux a des compteurs NULL', async () => {
    const slug = await createResidence([
      { type: 't1', ...FULL, nbTotal: 7, nbAvailable: 2 },
      { type: 't3', ...FULL },
    ])
    await forceTypologyColumns(slug, 't3', { nbTotal: null, nbAvailable: null, priceMin: null, priceMax: null })

    await ownerCaller.bailleur.update({ slug, typologies: (await formDefaults(slug)) as never })

    const acc = await accommodationBySlug(slug)
    expect(acc.nbTotalApartments).toBe(7)
    expect(acc.nbAvailableApartments).toBe(2)
    expect(acc.priceMin).toBe(400)
    expect(acc.priceMax).toBe(600)
  })

  it('rejette une superficie à 0 mais accepte une superficie absente', async () => {
    const slug = await createResidence([{ type: 't1', ...FULL }])

    await expect(
      ownerCaller.bailleur.update({ slug, typologies: [{ type: 't1', superficieMin: 0, colocation: false }] as never }),
    ).rejects.toThrow()

    await expect(ownerCaller.bailleur.update({ slug, typologies: [{ type: 't1', colocation: false }] as never })).resolves.toBeDefined()
  })
})
