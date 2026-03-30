import { beforeEach, describe, expect, it } from 'vitest'
import { createAcademy, createAccommodation, createCity, createDepartment, createOwner } from './fixtures/factories'
import { caller } from './helpers/test-caller'

describe('territories.listAcademies', () => {
  it('returns academies sorted by name', async () => {
    await createAcademy({ name: 'Académie de Paris' })
    await createAcademy({ name: 'Académie de Lyon' })
    await createAcademy({ name: 'Académie de Bordeaux' })

    const result = await caller.territories.listAcademies()
    const names = result.map((a) => a.name)
    expect(names).toEqual(['Académie de Bordeaux', 'Académie de Lyon', 'Académie de Paris'])
  })
})

describe('territories.listDepartments', () => {
  it('excludes departments with empty names and returns sorted', async () => {
    const academy = await createAcademy()
    await createDepartment({ academyId: academy.id, name: 'Loire', code: '42' })
    await createDepartment({ academyId: academy.id, name: '', code: '00' })
    await createDepartment({ academyId: academy.id, name: 'Ain', code: '01' })

    const result = await caller.territories.listDepartments()
    const names = result.map((d) => d.name)
    expect(names).not.toContain('')
    expect(names).toEqual(['Ain', 'Loire'])
  })
})

describe('territories.listCities', () => {
  let academyId: number
  let dept42Id: number
  let dept69Id: number
  let saintEtienneCityId: number
  let lyonCityId: number

  beforeEach(async () => {
    const academy = await createAcademy()
    academyId = academy.id
    const dept42 = await createDepartment({ academyId, name: 'Loire', code: '42' })
    const dept69 = await createDepartment({ academyId, name: 'Rhône', code: '69' })
    dept42Id = dept42.id
    dept69Id = dept69.id

    const se = await createCity({ departmentId: dept42Id, name: 'Saint-Étienne', slug: 'saint-etienne', popular: true })
    const ly = await createCity({ departmentId: dept69Id, name: 'Lyon', slug: 'lyon', popular: true })
    await createCity({ departmentId: dept42Id, name: 'Roanne', slug: 'roanne', popular: false })
    saintEtienneCityId = se.id
    lyonCityId = ly.id
  })

  it('filters by departmentCode', async () => {
    const result = await caller.territories.listCities({ departmentCode: '42' })
    const names = result.map((c) => c.name)
    expect(names).toContain('Saint-Étienne')
    expect(names).toContain('Roanne')
    expect(names).not.toContain('Lyon')
  })

  it('filters popular cities', async () => {
    const result = await caller.territories.listCities({ popular: true })
    const names = result.map((c) => c.name)
    expect(names).toContain('Saint-Étienne')
    expect(names).toContain('Lyon')
    expect(names).not.toContain('Roanne')
  })

  it('sets majority_crous when most apartments belong to CROUS owner', async () => {
    const crousOwner = await createOwner({ name: 'CROUS', slug: 'crous' })
    const otherOwner = await createOwner({ name: 'Privé', slug: 'prive' })

    // Saint-Étienne: 8 CROUS + 2 other = majority CROUS
    await createAccommodation({ cityId: saintEtienneCityId, ownerId: crousOwner.id, nbTotalApartments: 8 })
    await createAccommodation({ cityId: saintEtienneCityId, ownerId: otherOwner.id, nbTotalApartments: 2 })

    // Lyon: 3 CROUS + 7 other = NOT majority CROUS
    await createAccommodation({ cityId: lyonCityId, ownerId: crousOwner.id, nbTotalApartments: 3 })
    await createAccommodation({ cityId: lyonCityId, ownerId: otherOwner.id, nbTotalApartments: 7 })

    const result = await caller.territories.listCities({ popular: true })
    const saintEtienne = result.find((c) => c.name === 'Saint-Étienne')
    const lyon = result.find((c) => c.name === 'Lyon')

    expect(saintEtienne?.majority_crous).toBe(true)
    expect(lyon?.majority_crous).toBe(false)
  })
})

describe('territories.getCityDetails', () => {
  let departmentId: number

  beforeEach(async () => {
    const academy = await createAcademy()
    const department = await createDepartment({ academyId: academy.id })
    departmentId = department.id
  })

  it('returns city with accommodation stats', async () => {
    const city = await createCity({ departmentId, name: 'Saint-Étienne', slug: 'saint-etienne' })
    await createAccommodation({
      cityId: city.id,
      nbTotalApartments: 10,
      priceMin: 300,
      published: true,
      available: true,
    })
    await createAccommodation({
      cityId: city.id,
      nbTotalApartments: 5,
      priceMin: 250,
      published: true,
      available: true,
    })

    const result = await caller.territories.getCityDetails({ slug: 'saint-etienne' })
    expect(result.name).toBe('Saint-Étienne')
    expect(result.nb_total_apartments).toBe(15)
    expect(result.price_min).toBe(250)
  })

  it('returns empty nearby_cities without geometry', async () => {
    await createCity({ departmentId, name: 'Saint-Étienne', slug: 'saint-etienne' })

    const result = await caller.territories.getCityDetails({ slug: 'saint-etienne' })
    expect(result.nearby_cities).toEqual([])
  })

  it('throws if slug is unknown', async () => {
    await expect(caller.territories.getCityDetails({ slug: 'unknown-city' })).rejects.toThrow('City not found')
  })
})

describe('territories.rentSearch', () => {
  it('returns results from loyers.json', async () => {
    const result = await caller.territories.rentSearch({ q: 'paris' })
    expect(result.cities.length).toBeGreaterThan(0)
    expect(result.cities[0]).toHaveProperty('city')
    expect(result.cities[0]).toHaveProperty('rentPerM2')
    expect(result.cities[0]).toHaveProperty('rentFor20M2')
  })
})
