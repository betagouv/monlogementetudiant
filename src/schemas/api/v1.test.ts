import { describe, expect, it } from 'vitest'
import { ZAccommodationsListQuery, ZApiContactsListQuery } from '~/schemas/api/v1'

describe('ZAccommodationsListQuery', () => {
  it('applique les valeurs par défaut', () => {
    const parsed = ZAccommodationsListQuery.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.page_size).toBe(12)
    expect(parsed.radius).toBe(10)
    expect(parsed.city_slugs).toBeUndefined()
    expect(parsed.crous).toBeUndefined()
  })

  it('découpe les listes CSV en tableaux nettoyés', () => {
    const parsed = ZAccommodationsListQuery.parse({ city_slugs: 'paris, ,lyon ', postal_codes: '75001,69001' })
    expect(parsed.city_slugs).toEqual(['paris', 'lyon'])
    expect(parsed.postal_codes).toEqual(['75001', '69001'])
  })

  it('parse les booléens de façon robuste', () => {
    expect(ZAccommodationsListQuery.parse({ crous: 'true' }).crous).toBe(true)
    expect(ZAccommodationsListQuery.parse({ crous: 'false' }).crous).toBe(false)
    expect(ZAccommodationsListQuery.parse({}).crous).toBeUndefined()
  })

  it('coerce et borne la pagination', () => {
    expect(ZAccommodationsListQuery.parse({ page: '3', page_size: '50' }).page_size).toBe(50)
    expect(ZAccommodationsListQuery.safeParse({ page_size: '500' }).success).toBe(false)
    expect(ZAccommodationsListQuery.safeParse({ page: '0' }).success).toBe(false)
  })
})

describe('ZApiContactsListQuery', () => {
  it('applique les valeurs par défaut', () => {
    const parsed = ZApiContactsListQuery.parse({})
    expect(parsed).toMatchObject({ page: 1, page_size: 20, order: 'desc' })
    expect(parsed.status).toBeUndefined()
  })

  it('découpe les statuts CSV en tableau', () => {
    expect(ZApiContactsListQuery.parse({ status: 'a_contacter,contacte' }).status).toEqual(['a_contacter', 'contacte'])
  })

  it('rejette un statut inconnu avec un message français', () => {
    const r = ZApiContactsListQuery.safeParse({ status: 'foo' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Statut inconnu')
  })

  it('rejette page_size > 100 et une date invalide', () => {
    expect(ZApiContactsListQuery.safeParse({ page_size: '101' }).success).toBe(false)
    expect(ZApiContactsListQuery.safeParse({ created_since: 'hier' }).success).toBe(false)
    expect(ZApiContactsListQuery.safeParse({ created_since: '2026-11-01T00:00:00+01:00' }).success).toBe(true)
    expect(ZApiContactsListQuery.safeParse({ created_since: '2026-11-01T00:00:00Z' }).success).toBe(true)
  })

  it('convertit les dates ISO en Date', () => {
    expect(ZApiContactsListQuery.parse({ created_since: '2026-11-01T00:00:00Z' }).created_since).toEqual(new Date('2026-11-01T00:00:00Z'))
  })
})
