import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCityId } from '~/server/trpc/utils/resolve-city'
import { createAcademy, createCity, createDepartment } from './fixtures/factories'

describe('resolveCityId', () => {
  let departmentId: number

  beforeEach(async () => {
    const academy = await createAcademy({ name: 'Académie Amiens' })
    departmentId = (await createDepartment({ academyId: academy.id, name: 'Aisne', code: '02' })).id
  })

  describe('multiple cities sharing the same postal code (02000)', () => {
    let laonId: number
    let brayeId: number

    beforeEach(async () => {
      const laon = await createCity({ departmentId, name: 'Laon', slug: 'laon', postalCodes: ['02000'] })
      laonId = laon.id
      const braye = await createCity({ departmentId, name: 'Braye-en-Laonnois', slug: 'braye-en-laonnois', postalCodes: ['02000'] })
      brayeId = braye.id
    })

    it('resolves Laon when city name is Laon', async () => {
      const result = await resolveCityId('02000', 'Laon')
      expect(result).toBe(laonId)
    })

    it('resolves Braye-en-Laonnois when city name is Braye-en-Laonnois', async () => {
      const result = await resolveCityId('02000', 'Braye-en-Laonnois')
      expect(result).toBe(brayeId)
    })

    it('is case-insensitive on city name', async () => {
      const result = await resolveCityId('02000', 'laon')
      expect(result).toBe(laonId)
    })
  })

  describe('fallback by postal code only', () => {
    let cityId: number

    beforeEach(async () => {
      const city = await createCity({ departmentId, name: 'Laon', slug: 'laon-fb', postalCodes: ['02000'] })
      cityId = city.id
    })

    it('resolves when city name does not match but postal code does', async () => {
      const result = await resolveCityId('02000', 'Ville Inconnue')
      expect(result).toBe(cityId)
    })
  })

  describe('fallback by city name only', () => {
    let cityId: number

    beforeEach(async () => {
      const city = await createCity({ departmentId, name: 'Laon', slug: 'laon-fn', postalCodes: ['02000'] })
      cityId = city.id
    })

    it('resolves when postal code does not match but city name does', async () => {
      const result = await resolveCityId('99999', 'Laon')
      expect(result).toBe(cityId)
    })
  })

  describe('no match', () => {
    it('returns null when nothing matches', async () => {
      const result = await resolveCityId('99999', 'Ville Inconnue')
      expect(result).toBeNull()
    })
  })
})
