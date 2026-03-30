import { beforeEach, describe, expect, it } from 'vitest'
import { createAcademy, createCity, createDepartment } from './fixtures/factories'
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
    it.each(['saint etienne', 'SAINT ETIENNE', 'saint étienne'])('finds "Saint-Étienne" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Étienne')
    })
  })

  describe('academies search', () => {
    it.each(['Academie de Lyon', 'académie de lyon', 'ACADEMIE'])('finds "Académie de Lyon" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const academyNames = result.academies.map((a) => a.name)
      expect(academyNames).toContain('Académie de Lyon')
    })
  })

  describe('departments search', () => {
    it.each(['loire', 'Loire', 'LOIRE'])('finds "Loire" with query "%s"', async (q) => {
      const result = await caller.territories.search({ q })
      const departmentNames = result.departments.map((d) => d.name)
      expect(departmentNames).toContain('Loire')
    })
  })

  describe('Luçon search', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Luçon', slug: 'lucon' })
    })

    it.each(['lucon', 'Luçon', 'LUCON'])('finds "Luçon" with query "%s"', async (q) => {
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

    it('empty string returns empty', async () => {
      const result = await caller.territories.search({ q: '' })
      expect(result.academies).toEqual([])
      expect(result.departments).toEqual([])
      expect(result.cities).toEqual([])
    })

    it('hyphen-only query returns empty', async () => {
      const result = await caller.territories.search({ q: '-' })
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

  describe('ranking: exact match beats substring', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Saint-Denis', slug: 'saint-denis-93', postalCodes: ['93200'] })
      await createCity({ departmentId, name: 'Camiac-et-Saint-Denis', slug: 'camiac-et-saint-denis', postalCodes: ['33420'] })
      await createCity({ departmentId, name: 'Chassagne-Saint-Denis', slug: 'chassagne-saint-denis', postalCodes: ['25360'] })
      await createCity({ departmentId, name: 'Estrées-Saint-Denis', slug: 'estrees-saint-denis', postalCodes: ['60190'] })
      await createCity({ departmentId, name: 'Fonds-Saint-Denis', slug: 'fonds-saint-denis', postalCodes: ['97250'] })
      await createCity({ departmentId, name: 'Le Gault-Saint-Denis', slug: 'le-gault-saint-denis', postalCodes: ['28800'] })
      await createCity({ departmentId, name: 'Le Mesnil-Saint-Denis', slug: 'le-mesnil-saint-denis', postalCodes: ['78320'] })
      await createCity({ departmentId, name: 'Le Tertre-Saint-Denis', slug: 'le-tertre-saint-denis', postalCodes: ['78980'] })
      await createCity({ departmentId, name: "L'Île-Saint-Denis", slug: 'l-ile-saint-denis', postalCodes: ['93450'] })
      await createCity({ departmentId, name: 'Morey-Saint-Denis', slug: 'morey-saint-denis', postalCodes: ['21220'] })
      await createCity({ departmentId, name: 'Neuville Saint Denis', slug: 'neuville-saint-denis', postalCodes: ['28800'] })
    })

    it.each([
      'saint-denis',
      'Saint-Denis',
      'saint denis',
      'Saint Denis',
      'st denis',
      'st-denis',
    ])('"%s" ranks "Saint-Denis" first among many *-Saint-Denis cities', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Denis')
      expect(cityNames[0]).toBe('Saint-Denis')
    })

    it('"saint-denis" returns Saint-Denis within the limit of 10', async () => {
      const result = await caller.territories.search({ q: 'saint-denis' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Saint-Denis')
      expect(cityNames.length).toBeLessThanOrEqual(10)
    })
  })

  describe('ranking: prefix match beats middle match', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Lyon', slug: 'lyon' })
      await createCity({ departmentId, name: "Collonges-au-Mont-d'Or", slug: 'collonges-lyon', postalCodes: ['69660'] })
    })

    it('"lyon" ranks Lyon before Collonges', async () => {
      const result = await caller.territories.search({ q: 'lyon' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames[0]).toBe('Lyon')
    })
  })

  describe('ranking: exact match with hyphens', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Saint-Lô', slug: 'saint-lo' })
      await createCity({ departmentId, name: 'Saint-Louis', slug: 'saint-louis' })
      await createCity({ departmentId, name: 'Saint-Laurent-du-Var', slug: 'saint-laurent-du-var' })
    })

    it('"saint-lo" ranks Saint-Lô first (exact match)', async () => {
      const result = await caller.territories.search({ q: 'saint-lo' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames[0]).toBe('Saint-Lô')
    })

    it('"saint-louis" ranks Saint-Louis before Saint-Laurent-du-Var', async () => {
      const result = await caller.territories.search({ q: 'saint-louis' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames[0]).toBe('Saint-Louis')
    })
  })

  describe('ranking: multiple exact matches with different departments', () => {
    beforeEach(async () => {
      const dept2 = await createDepartment({ academyId, name: 'Réunion', code: '974' })
      await createCity({ departmentId, name: 'Saint-Denis', slug: 'saint-denis-93', postalCodes: ['93200'] })
      await createCity({ departmentId: dept2.id, name: 'Saint-Denis', slug: 'saint-denis-974', postalCodes: ['97400'] })
      await createCity({ departmentId, name: 'Estrées-Saint-Denis', slug: 'estrees-saint-denis', postalCodes: ['60190'] })
    })

    it('"saint-denis" returns both Saint-Denis before Estrées-Saint-Denis', async () => {
      const result = await caller.territories.search({ q: 'saint-denis' })
      const cityNames = result.cities.map((c) => c.name)
      const saintDenisIndices = cityNames.map((name, i) => (name === 'Saint-Denis' ? i : -1)).filter((i) => i >= 0)
      const estreesIndex = cityNames.indexOf('Estrées-Saint-Denis')

      expect(saintDenisIndices.length).toBe(2)
      expect(saintDenisIndices.every((i) => i < estreesIndex)).toBe(true)
    })
  })

  describe('abbreviation expansion: ste → saint', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Sainte-Marie', slug: 'sainte-marie' })
    })

    it.each(['ste marie', 'Ste-Marie', 'sainte marie'])('"%s" finds Sainte-Marie', async (q) => {
      const result = await caller.territories.search({ q })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Sainte-Marie')
    })
  })

  describe('ligature æ', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Cæn', slug: 'caen' })
    })

    it('"caen" finds Cæn', async () => {
      const result = await caller.territories.search({ q: 'caen' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Cæn')
    })
  })

  describe('partial token match', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Montpellier', slug: 'montpellier' })
      await createCity({ departmentId, name: 'Mont-de-Marsan', slug: 'mont-de-marsan' })
    })

    it('"montpel" finds Montpellier but not Mont-de-Marsan', async () => {
      const result = await caller.territories.search({ q: 'montpel' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Montpellier')
      expect(cityNames).not.toContain('Mont-de-Marsan')
    })

    it('"mont" finds both Montpellier and Mont-de-Marsan', async () => {
      const result = await caller.territories.search({ q: 'mont' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Montpellier')
      expect(cityNames).toContain('Mont-de-Marsan')
    })
  })

  describe('multi-token search', () => {
    beforeEach(async () => {
      await createCity({ departmentId, name: 'Aix-en-Provence', slug: 'aix-en-provence' })
      await createCity({ departmentId, name: 'Aix-les-Bains', slug: 'aix-les-bains' })
    })

    it('"aix provence" finds Aix-en-Provence but not Aix-les-Bains', async () => {
      const result = await caller.territories.search({ q: 'aix provence' })
      const cityNames = result.cities.map((c) => c.name)
      expect(cityNames).toContain('Aix-en-Provence')
      expect(cityNames).not.toContain('Aix-les-Bains')
    })
  })

  describe('results limit', () => {
    beforeEach(async () => {
      for (let i = 0; i < 15; i++) {
        await createCity({ departmentId, name: `Testville-${i}`, slug: `testville-${i}` })
      }
    })

    it('returns at most 10 cities', async () => {
      const result = await caller.territories.search({ q: 'testville' })
      expect(result.cities.length).toBeLessThanOrEqual(10)
    })
  })

  describe('simultaneous entity search', () => {
    beforeEach(async () => {
      await createAcademy({ name: 'Académie de Nantes' })
      await createDepartment({ academyId, name: 'Loire-Atlantique', code: '44' })
      await createCity({ departmentId, name: 'Nantes', slug: 'nantes' })
    })

    it('"nantes" returns results in cities and academies', async () => {
      const result = await caller.territories.search({ q: 'nantes' })
      expect(result.cities.map((c) => c.name)).toContain('Nantes')
      expect(result.academies.map((a) => a.name)).toContain('Académie de Nantes')
    })

    it('"loire" returns results in departments', async () => {
      const result = await caller.territories.search({ q: 'loire' })
      const deptNames = result.departments.map((d) => d.name)
      expect(deptNames).toContain('Loire')
      expect(deptNames).toContain('Loire-Atlantique')
    })
  })
})
