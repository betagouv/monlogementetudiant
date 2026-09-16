import { describe, expect, it } from 'vitest'
import { TTypologiesRecord, TTypologyView } from '~/schemas/accommodations/accommodations'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { typologyFormDefaults } from './typology-form-defaults'

/** Une typologie telle que lue en base : tous les champs numériques sont nullables. */
const view = (over: Partial<TTypologyView> = {}): TTypologyView => ({
  priceMin: 400,
  priceMax: 600,
  superficieMin: 15,
  superficieMax: 25,
  nbTotal: 10,
  nbAvailable: 5,
  colocation: false,
  ...over,
})

/** Toutes les colonnes numériques à NULL (typologie créée par un import partiel). */
const allNull = (): TTypologyView => ({
  priceMin: null,
  priceMax: null,
  superficieMin: null,
  superficieMax: null,
  nbTotal: null,
  nbAvailable: null,
  colocation: false,
})

const NUMERIC_FIELDS = ['priceMin', 'priceMax', 'superficieMin', 'superficieMax', 'nbTotal', 'nbAvailable'] as const

describe('typologyFormDefaults — données complètes', () => {
  it('reprend les valeurs telles quelles quand la base est renseignée', () => {
    const [t1] = typologyFormDefaults({ t1: view() })

    expect(t1).toEqual({
      type: 't1',
      priceMin: 400,
      priceMax: 600,
      superficieMin: 15,
      superficieMax: 25,
      nbTotal: 10,
      nbAvailable: 5,
      colocation: false,
    })
  })

  it('préserve colocation à true comme à false', () => {
    expect(typologyFormDefaults({ t1: view({ colocation: true }) })[0].colocation).toBe(true)
    expect(typologyFormDefaults({ t1: view({ colocation: false }) })[0].colocation).toBe(false)
  })

  it('ne retourne que les typologies présentes, dans l’ordre de TYPOLOGIES', () => {
    const record: TTypologiesRecord = { t3: view(), t1: view(), t7_more: view() }

    expect(typologyFormDefaults(record).map((t) => t.type)).toEqual(['t1', 't3', 't7_more'])
  })

  it('retourne un tableau vide quand aucune typologie n’existe', () => {
    expect(typologyFormDefaults({})).toEqual([])
  })
})

describe('typologyFormDefaults — données absentes (NULL en base)', () => {
  it.each(NUMERIC_FIELDS)('convertit %s NULL en undefined (champ vide, pas 0)', (field) => {
    const [t1] = typologyFormDefaults({ t1: view({ [field]: null }) })

    expect(t1[field]).toBeUndefined()
    expect(t1[field]).not.toBe(0)
  })

  it('convertit une typologie entièrement NULL en champs tous vides', () => {
    const [t1] = typologyFormDefaults({ t1: allNull() })

    expect(t1).toEqual({
      type: 't1',
      priceMin: undefined,
      priceMax: undefined,
      superficieMin: undefined,
      superficieMax: undefined,
      nbTotal: undefined,
      nbAvailable: undefined,
      colocation: false,
    })
  })

  it('traite undefined comme NULL (champ absent de l’objet de lecture)', () => {
    // Un objet issu d'une source qui omet les clés plutôt que de les mettre à null.
    const partial = { colocation: false } as unknown as TTypologyView
    const [t1] = typologyFormDefaults({ t1: partial })

    for (const field of NUMERIC_FIELDS) expect(t1[field]).toBeUndefined()
  })

  it('gère une typologie partiellement renseignée sans écraser les valeurs connues', () => {
    const [t1] = typologyFormDefaults({ t1: view({ superficieMin: null, superficieMax: null, nbAvailable: null }) })

    expect(t1.priceMin).toBe(400)
    expect(t1.nbTotal).toBe(10)
    expect(t1.superficieMin).toBeUndefined()
    expect(t1.nbAvailable).toBeUndefined()
  })
})

describe('typologyFormDefaults — la valeur 0', () => {
  // Régression `||` vs `??` : 0 est une donnée renseignée, pas une donnée manquante.
  it.each(NUMERIC_FIELDS)('conserve %s à 0 au lieu de le vider', (field) => {
    const [t1] = typologyFormDefaults({ t1: view({ [field]: 0 }) })

    expect(t1[field]).toBe(0)
    expect(t1[field]).not.toBeUndefined()
  })

  it('distingue 0 de NULL sur deux typologies voisines', () => {
    const [t1, t2] = typologyFormDefaults({ t1: view({ nbAvailable: 0 }), t2: view({ nbAvailable: null }) })

    expect(t1.nbAvailable).toBe(0)
    expect(t2.nbAvailable).toBeUndefined()
  })
})

describe('typologyFormDefaults — le formulaire reste soumettable', () => {
  const submit = (typologies: TTypologiesRecord) => ZUpdateResidence.safeParse({ typologies: typologyFormDefaults(typologies) })

  it('accepte une résidence dont toutes les typologies sont renseignées', () => {
    expect(submit({ t1: view(), t2: view() }).success).toBe(true)
  })

  it('accepte une résidence dont les typologies sont entièrement NULL en base', () => {
    // Aucune donnée saisie : aucune erreur de bornes.
    expect(submit({ t1: allNull(), t3: allNull() }).success).toBe(true)
  })

  it('accepte une résidence partiellement renseignée (loyers seuls)', () => {
    expect(submit({ t1: { ...allNull(), priceMin: 400, priceMax: 600 } }).success).toBe(true)
  })

  it('accepte un loyer et une disponibilité à 0', () => {
    expect(submit({ t1: view({ priceMin: 0, priceMax: 0, nbAvailable: 0 }) }).success).toBe(true)
  })

  it('signale toujours une superficie à 0 réellement stockée en base', () => {
    // 0 m² est une donnée aberrante : elle doit remonter comme erreur, pas être masquée.
    const result = submit({ t1: view({ superficieMin: 0 }) })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.join('.') === 'typologies.0.superficieMin')).toBe(true)
  })

  it('signale toujours les incohérences entre deux valeurs renseignées', () => {
    const result = submit({ t1: view({ superficieMin: 30, superficieMax: 20 }) })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.join('.') === 'typologies.0.superficieMin')).toBe(true)
  })

  it('n’invente pas d’incohérence quand un seul des deux côtés est renseigné', () => {
    expect(submit({ t1: view({ superficieMin: 30, superficieMax: null }) }).success).toBe(true)
    expect(submit({ t1: view({ nbTotal: null, nbAvailable: 10 }) }).success).toBe(true)
    expect(submit({ t1: view({ priceMin: 900, priceMax: null }) }).success).toBe(true)
  })
})
