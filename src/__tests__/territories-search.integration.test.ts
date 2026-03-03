import { beforeEach, describe, expect, it } from 'vitest'
import { createAccommodation, createAcademy, createCity, createDepartment } from './fixtures/factories'
import { caller } from './helpers/test-caller'

describe('territories.search', () => {
  let academyId: number
  let departmentId: number

  beforeEach(async () => {
    const academy = await createAcademy({ name: 'Académie de Lyon' })
    academyId = academy.id
    const department = await createDepartment({ academyId, name: 'Loire', code: '42' })
    departmentId = department.id
    await createCity({ departmentId, name: 'Saint-Étienne', slug: 'saint-etienne' })
    await createCity({ departmentId, name: 'Saint-Malo', slug: 'saint-malo' })
  })

  describe('Saint-Étienne query variants', () => {
    it.each([
      'Saint Etienne',
      'Saint-Etienne',
      'st etienne',
      'St-Étienne',
      'saint-etie',
      'st etie',
    ])('finds "Saint-Étienne" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Étienne')
    })
  })

  describe('case/accent insensitive', () => {
    it.each([
      'saint etienne',
      'SAINT ETIENNE',
      'saint étienne',
    ])('finds "Saint-Étienne" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Étienne')
    })
  })

  describe('academies search', () => {
    it.each([
      'Academie de Lyon',
      'académie de lyon',
      'ACADEMIE',
    ])('finds "Académie de Lyon" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const academyNames = result.academies.map((a) => a.name)
      expect(academyNames).toContain('Académie de Lyon')
    })
  })

  describe('departments search', () => {
    it.each([
      'loire',
      'Loire',
      'LOIRE',
    ])('finds "Loire" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const departmentNames = result.departments.map((d) => d.name)
      expect(departmentNames).toContain('Loire')
    })
  })

  describe('Luçon search', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Luçon', slug: 'lucon' })
    })

    it.each([
      'lucon',
      'Luçon',
      'LUCON',
    ])('finds "Luçon" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Luçon')
    })
  })

  describe('token filtering', () => {
    it('"saint etienne" finds Saint-Étienne but NOT Saint-Malo', async () => {
      const result = await caller.territories.search({ q: 'saint etienne' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Étienne')
      expect(cityNames).not.toContain('Saint-Malo')
    })
  })

  describe('ligature œ', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Œuilly', slug: 'oeuilly' })
      await createCity({ departmentId, name: 'Orléans', slug: 'orleans' })
    })

    it('"oeuilly" finds Œuilly but NOT Orléans', async () => {
      const result = await caller.territories.search({ q: 'oeuilly' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Œuilly')
      expect(cityNames).not.toContain('Orléans')
    })
  })

  describe('edge cases', () => {
    it('whitespace-only query returns empty', async () => {
      const result = await caller.territories.search({ q: '   ' })
      expect(result.academies).toEqual([])
      expect(result.departments).toEqual([])
      expect(result.cities).toEqual([])
    })

    it('single char query returns empty', async () => {
      const result = await caller.territories.search({ q: 'a' })
      expect(result.academies).toEqual([])
      expect(result.departments).toEqual([])
      expect(result.cities).toEqual([])
    })
  })

  describe('ranking', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Marseille', slug: 'marseille' })
      await createCity({ departmentId, name: 'Famars', slug: 'famars' })
    })

    it('"mars" ranks Marseille before Famars (prefix match)', async () => {
      const result = await caller.territories.search({ q: 'mars' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Marseille')
      expect(cityNames).toContain('Famars')
      expect(cityNames.indexOf('Marseille')).toBeLessThan(cityNames.indexOf('Famars'))
    })
  })
})
