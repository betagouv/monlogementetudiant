import { describe, expect, it } from 'vitest'
import { createAcademy, createAccommodation, createExternalSource, createOwner } from './fixtures/factories'
import { caller } from './helpers/test-caller'
import './helpers/setup-integration'

describe('accommodations.list', () => {
  it('returns only published accommodations with geom', async () => {
    await createAccommodation({
      slug: 'published-with-geom',
      published: true,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'unpublished',
      published: false,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'no-geom',
      published: true,
    })

    const result = await caller.accommodations.list({})
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('published-with-geom')
  })

  it('filters by bbox', async () => {
    await createAccommodation({
      slug: 'inside-bbox',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })
    await createAccommodation({
      slug: 'outside-bbox',
      geom: { type: 'Point', coordinates: [5.0, 43.3] },
    })

    const result = await caller.accommodations.list({ bbox: '2.0,48.5,3.0,49.0' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('inside-bbox')
  })

  it('filters by isAccessible', async () => {
    await createAccommodation({
      slug: 'accessible',
      nbAccessibleApartments: 5,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'not-accessible',
      nbAccessibleApartments: 0,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ isAccessible: true })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('accessible')
  })

  it('filters by hasColiving', async () => {
    await createAccommodation({
      slug: 'coliving',
      nbColivingApartments: 3,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'no-coliving',
      nbColivingApartments: 0,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ hasColiving: true })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('coliving')
  })

  it('filters by priceMax', async () => {
    await createAccommodation({
      slug: 'cheap',
      priceMin: 300,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'expensive',
      priceMin: 800,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ priceMax: 500 })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('cheap')
  })

  it('filters by viewCrous=true (only crous)', async () => {
    const crousAccom = await createAccommodation({
      slug: 'crous-residence',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createExternalSource({ accommodationId: crousAccom.id, source: 'crous' })

    await createAccommodation({
      slug: 'non-crous',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ viewCrous: true })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('crous-residence')
  })

  it('excludes crous when viewCrous is false', async () => {
    const crousAccom = await createAccommodation({
      slug: 'crous-res',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createExternalSource({ accommodationId: crousAccom.id, source: 'crous' })

    await createAccommodation({
      slug: 'non-crous-res',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ viewCrous: false })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('non-crous-res')
  })

  it('excludes crous when viewCrous is not specified (default false)', async () => {
    const crousAccom = await createAccommodation({
      slug: 'crous-default',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createExternalSource({ accommodationId: crousAccom.id, source: 'crous' })

    await createAccommodation({
      slug: 'non-crous-default',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({})
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('non-crous-default')
  })

  it('filters by academyId (spatial)', async () => {
    const academy = await createAcademy({
      name: 'Académie de Paris',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [2.0, 48.5],
              [3.0, 48.5],
              [3.0, 49.0],
              [2.0, 49.0],
              [2.0, 48.5],
            ],
          ],
        ],
      },
    })

    await createAccommodation({
      slug: 'in-academy',
      geom: { type: 'Point', coordinates: [2.5, 48.75] },
    })
    await createAccommodation({
      slug: 'out-academy',
      geom: { type: 'Point', coordinates: [5.0, 43.3] },
    })

    const result = await caller.accommodations.list({ academyId: academy.id })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('in-academy')
  })

  it('orders by priority (available first)', async () => {
    await createAccommodation({
      slug: 'no-availability',
      nbT1Available: 0,
      nbT2Available: 0,
      acceptWaitingList: false,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'has-availability',
      nbT1Available: 5,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({})
    expect(result.results.features[0].properties.slug).toBe('has-availability')
    expect(result.results.features[1].properties.slug).toBe('no-availability')
  })

  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await createAccommodation({
        slug: `residence-${i}`,
        geom: { type: 'Point', coordinates: [4.39, 45.44] },
      })
    }

    const page1 = await caller.accommodations.list({ page: 1, pageSize: 2 })
    expect(page1.count).toBe(5)
    expect(page1.page_size).toBe(2)
    expect(page1.results.features).toHaveLength(2)
    expect(page1.next).toBe('2')

    const page3 = await caller.accommodations.list({ page: 3, pageSize: 2 })
    expect(page3.results.features).toHaveLength(1)
    expect(page3.next).toBeNull()
    expect(page3.previous).toBe('2')
  })

  it('computes price bounds', async () => {
    await createAccommodation({
      slug: 'a1',
      priceMinT1: 200,
      priceMaxT1: 400,
      priceMinT2: 300,
      priceMaxT2: 600,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'a2',
      priceMinT1: 150,
      priceMaxT1: 350,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({})
    expect(result.min_price).toBe(150)
    expect(result.max_price).toBe(600)
  })

  it('returns GeoJSON format', async () => {
    const owner = await createOwner({ name: 'CROUS', slug: 'crous', url: 'https://crous.fr' })
    await createAccommodation({
      slug: 'geojson-test',
      ownerId: owner.id,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const result = await caller.accommodations.list({})
    const feature = result.results.features[0]
    expect(feature.geometry.type).toBe('Point')
    expect(feature.geometry.coordinates).toHaveLength(2)
    expect(feature.id).toBeTypeOf('number')
    expect(feature.properties.owner_name).toBe('CROUS')
    expect(feature.properties.owner_url).toBe('https://crous.fr')
  })
})

describe('accommodations.getBySlug', () => {
  it('returns full detail with owner', async () => {
    const owner = await createOwner({ name: 'CROUS', slug: 'crous', url: 'https://crous.fr' })
    await createAccommodation({
      slug: 'detail-test',
      name: 'Résidence Détail',
      description: 'A nice residence',
      address: '42 rue de la Paix',
      residenceType: 'residence-universitaire-conventionnee',
      ownerId: owner.id,
      nbTotalApartments: 100,
      priceMinT1: 200,
      priceMaxT1: 400,
      laundryRoom: true,
      wifi: true,
      parking: false,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const result = await caller.accommodations.getBySlug({ slug: 'detail-test' })
    expect(result.name).toBe('Résidence Détail')
    expect(result.description).toBe('A nice residence')
    expect(result.address).toBe('42 rue de la Paix')
    expect(result.residence_type).toBe('residence-universitaire-conventionnee')
    expect(result.nb_total_apartments).toBe(100)
    expect(result.price_min_t1).toBe(200)
    expect(result.price_max_t1).toBe(400)
    expect(result.laundry_room).toBe(true)
    expect(result.wifi).toBe(true)
    expect(result.parking).toBe(false)
    expect(result.geom.type).toBe('Point')
    expect(result.geom.coordinates).toEqual([2.35, 48.85])
    expect(result.owner).toEqual({
      name: 'CROUS',
      slug: 'crous',
      url: 'https://crous.fr',
      image_base64: null,
    })
  })

  it('returns amenities', async () => {
    await createAccommodation({
      slug: 'amenities-test',
      laundryRoom: true,
      commonAreas: true,
      bikeStorage: false,
      parking: true,
      secureAccess: true,
      residenceManager: true,
      kitchenType: 'private',
      desk: true,
      cookingPlates: true,
      microwave: false,
      refrigerator: true,
      bathroom: 'private',
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const result = await caller.accommodations.getBySlug({ slug: 'amenities-test' })
    expect(result.laundry_room).toBe(true)
    expect(result.common_areas).toBe(true)
    expect(result.bike_storage).toBe(false)
    expect(result.parking).toBe(true)
    expect(result.secure_access).toBe(true)
    expect(result.residence_manager).toBe(true)
    expect(result.kitchen_type).toBe('private')
    expect(result.desk).toBe(true)
    expect(result.cooking_plates).toBe(true)
    expect(result.microwave).toBe(false)
    expect(result.refrigerator).toBe(true)
    expect(result.bathroom).toBe('private')
  })

  it('returns detailed prices', async () => {
    await createAccommodation({
      slug: 'prices-test',
      priceMinT1: 200,
      priceMaxT1: 400,
      priceMinT2: 300,
      priceMaxT2: 600,
      priceMinT3: 400,
      priceMaxT3: 800,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    const result = await caller.accommodations.getBySlug({ slug: 'prices-test' })
    expect(result.price_min_t1).toBe(200)
    expect(result.price_max_t1).toBe(400)
    expect(result.price_min_t2).toBe(300)
    expect(result.price_max_t2).toBe(600)
    expect(result.price_max).toBe(800)
  })

  it('throws NOT_FOUND for unknown slug', async () => {
    await expect(caller.accommodations.getBySlug({ slug: 'nonexistent' })).rejects.toThrow('Accommodation not found')
  })

  it('throws NOT_FOUND for unpublished accommodation', async () => {
    await createAccommodation({
      slug: 'unpublished-detail',
      published: false,
      geom: { type: 'Point', coordinates: [2.35, 48.85] },
    })

    await expect(caller.accommodations.getBySlug({ slug: 'unpublished-detail' })).rejects.toThrow('Accommodation not found')
  })
})
