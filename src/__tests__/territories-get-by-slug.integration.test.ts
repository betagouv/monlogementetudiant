import { describe, expect, it } from 'vitest'
import { createAcademy, createCity, createDepartment } from './fixtures/factories'
import { caller } from './helpers/test-caller'

/**
 * Le segment de l'URL n'est pas toujours le slug canonique : des liens historiques sont construits
 * sur le `name` du territoire, et des URLs de cette forme sont déjà indexées. `getBySlug` doit les
 * résoudre pour que la page puisse rediriger vers l'URL canonique au lieu de renvoyer sur la
 * recherche générique.
 */
describe('territories.getBySlug', () => {
  const seed = async () => {
    const academy = await createAcademy({ name: 'Académie de Poitiers', slug: 'poitiers' })
    const department = await createDepartment({
      academyId: academy.id,
      name: 'La Réunion',
      code: '974',
      // Les slugs de départements conservent les accents, ceux des villes non.
      slug: 'la-réunion',
    })
    await createCity({ departmentId: department.id, name: 'La Rochelle', slug: 'la-rochelle' })
    await createCity({ departmentId: department.id, name: 'Créteil', slug: 'creteil' })
    return { academy, department }
  }

  it('résout une ville par son slug canonique', async () => {
    await seed()
    const city = await caller.territories.getBySlug({ type: 'ville', slug: 'la-rochelle' })
    expect(city.slug).toBe('la-rochelle')
  })

  it('résout une ville dont le nom contient une espace', async () => {
    await seed()
    const city = await caller.territories.getBySlug({ type: 'ville', slug: 'La Rochelle' })
    expect(city.slug).toBe('la-rochelle')
  })

  it('résout une ville dont le nom est accentué alors que son slug ne l’est pas', async () => {
    await seed()
    const city = await caller.territories.getBySlug({ type: 'ville', slug: 'Créteil' })
    expect(city.slug).toBe('creteil')
  })

  it('résout un département dont le slug est accentué, avec ou sans accent dans l’URL', async () => {
    await seed()
    const parNom = await caller.territories.getBySlug({ type: 'departement', slug: 'La Réunion' })
    expect(parNom.slug).toBe('la-réunion')

    const sansAccent = await caller.territories.getBySlug({ type: 'departement', slug: 'la-reunion' })
    expect(sansAccent.slug).toBe('la-réunion')
  })

  it('résout une académie par son nom', async () => {
    await seed()
    const academy = await caller.territories.getBySlug({ type: 'academie', slug: 'Poitiers' })
    expect(academy.slug).toBe('poitiers')
  })

  it('renvoie NOT_FOUND pour un territoire inconnu', async () => {
    await seed()
    await expect(caller.territories.getBySlug({ type: 'ville', slug: 'ville-inexistante' })).rejects.toThrow('City not found')
  })
})
