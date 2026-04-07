import { describe, expect, it } from 'vitest'
import { createAcademy, createAccommodation, createCity, createDepartment, createExternalSource, createOwner } from './fixtures/factories'
import './helpers/setup-integration'
import { caller } from './helpers/test-caller'

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

  it('filters by city radius using listExpandedByCity (outside boundary, within radius)', async () => {
    const academy = await createAcademy({ name: 'Académie de Paris' })
    const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris' })
    await createCity({
      departmentId: department.id,
      name: 'Paris',
      slug: 'paris',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [2.3, 48.8],
              [2.4, 48.8],
              [2.4, 48.9],
              [2.3, 48.9],
              [2.3, 48.8],
            ],
          ],
        ],
      },
    })

    // Outside city boundary but within 10km radius of centroid
    await createAccommodation({
      slug: 'near-paris',
      geom: { type: 'Point', coordinates: [2.42, 48.85] },
    })
    // Far away — outside radius
    await createAccommodation({
      slug: 'far-from-paris',
      geom: { type: 'Point', coordinates: [5.0, 43.3] },
    })

    const result = await caller.accommodations.listExpandedByCity({ city: 'paris' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('near-paris')
  })

  it('listExpandedByCity excludes accommodations inside the city boundary', async () => {
    const academy = await createAcademy({ name: 'Académie de Toulouse' })
    const department = await createDepartment({ academyId: academy.id, code: '31', name: 'Haute-Garonne' })
    await createCity({
      departmentId: department.id,
      name: 'Toulouse',
      slug: 'toulouse',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [1.38, 43.56],
              [1.5, 43.56],
              [1.5, 43.65],
              [1.38, 43.65],
              [1.38, 43.56],
            ],
          ],
        ],
      },
    })

    // Inside Toulouse boundary
    await createAccommodation({
      slug: 'in-toulouse',
      geom: { type: 'Point', coordinates: [1.44, 43.6] },
    })
    // Outside boundary but within 10km radius
    await createAccommodation({
      slug: 'near-toulouse',
      geom: { type: 'Point', coordinates: [1.35, 43.57] },
    })

    const result = await caller.accommodations.listExpandedByCity({ city: 'toulouse' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('near-toulouse')
  })

  it('listExpandedByCity never returns accommodations from the same city regardless of pagination', async () => {
    const academy = await createAcademy({ name: 'Académie de Marseille' })
    const department = await createDepartment({ academyId: academy.id, code: '13', name: 'Bouches-du-Rhône' })
    await createCity({
      departmentId: department.id,
      name: 'Marseille',
      slug: 'marseille',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [5.3, 43.2],
              [5.45, 43.2],
              [5.45, 43.35],
              [5.3, 43.35],
              [5.3, 43.2],
            ],
          ],
        ],
      },
    })

    // Create many accommodations inside Marseille (more than a typical page size)
    for (let i = 0; i < 15; i++) {
      await createAccommodation({
        slug: `marseille-residence-${i}`,
        geom: { type: 'Point', coordinates: [5.35 + i * 0.005, 43.28] },
      })
    }
    // One outside boundary but within radius
    await createAccommodation({
      slug: 'near-marseille-outside',
      geom: { type: 'Point', coordinates: [5.47, 43.28] },
    })

    // Call without excludeIds — boundary exclusion alone must filter all in-city results
    const result = await caller.accommodations.listExpandedByCity({ city: 'marseille' })
    expect(result.results.features.every((f) => f.properties.slug === 'near-marseille-outside')).toBe(true)
    expect(result.count).toBe(1)
  })

  it('listExpandedByCity combines boundary exclusion with excludeIds', async () => {
    const academy = await createAcademy({ name: 'Académie de Lyon' })
    const department = await createDepartment({ academyId: academy.id, code: '69', name: 'Rhône' })
    await createCity({
      departmentId: department.id,
      name: 'Lyon',
      slug: 'lyon',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [4.8, 45.72],
              [4.9, 45.72],
              [4.9, 45.8],
              [4.8, 45.8],
              [4.8, 45.72],
            ],
          ],
        ],
      },
    })

    // Inside Lyon — should be excluded by boundary
    await createAccommodation({
      slug: 'in-lyon',
      geom: { type: 'Point', coordinates: [4.85, 45.76] },
    })
    // Outside boundary, within radius — should be excluded by excludeIds
    const excluded = await createAccommodation({
      slug: 'near-lyon-excluded',
      geom: { type: 'Point', coordinates: [4.92, 45.76] },
    })
    // Outside boundary, within radius — should be returned
    await createAccommodation({
      slug: 'near-lyon-kept',
      geom: { type: 'Point', coordinates: [4.75, 45.76] },
    })

    const result = await caller.accommodations.listExpandedByCity({
      city: 'lyon',
      excludeIds: [excluded.id],
    })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('near-lyon-kept')
  })

  it('listExpandedByCity applies filters to results outside the city', async () => {
    const academy = await createAcademy({ name: 'Académie de Nantes' })
    const department = await createDepartment({ academyId: academy.id, code: '44', name: 'Loire-Atlantique' })
    await createCity({
      departmentId: department.id,
      name: 'Nantes',
      slug: 'nantes',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-1.62, 47.18],
              [-1.5, 47.18],
              [-1.5, 47.28],
              [-1.62, 47.28],
              [-1.62, 47.18],
            ],
          ],
        ],
      },
    })

    // Outside boundary, within radius, accessible
    await createAccommodation({
      slug: 'near-nantes-accessible',
      nbAccessibleApartments: 3,
      geom: { type: 'Point', coordinates: [-1.48, 47.23] },
    })
    // Outside boundary, within radius, not accessible
    await createAccommodation({
      slug: 'near-nantes-not-accessible',
      nbAccessibleApartments: 0,
      geom: { type: 'Point', coordinates: [-1.45, 47.23] },
    })

    const result = await caller.accommodations.listExpandedByCity({
      city: 'nantes',
      isAccessible: true,
    })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('near-nantes-accessible')
  })

  it('cityId combined with other filters', async () => {
    const academy = await createAcademy({ name: 'Académie de Bordeaux' })
    const department = await createDepartment({ academyId: academy.id, code: '33', name: 'Gironde' })
    const city = await createCity({
      departmentId: department.id,
      name: 'Bordeaux',
      slug: 'bordeaux',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-0.64, 44.81],
              [-0.54, 44.81],
              [-0.54, 44.88],
              [-0.64, 44.88],
              [-0.64, 44.81],
            ],
          ],
        ],
      },
    })

    await createAccommodation({
      slug: 'bordeaux-cheap-accessible',
      priceMin: 300,
      nbAccessibleApartments: 2,
      geom: { type: 'Point', coordinates: [-0.58, 44.84] },
    })
    await createAccommodation({
      slug: 'bordeaux-expensive',
      priceMin: 900,
      nbAccessibleApartments: 0,
      geom: { type: 'Point', coordinates: [-0.57, 44.85] },
    })

    const result = await caller.accommodations.list({
      cityId: city.id,
      priceMax: 500,
      isAccessible: true,
    })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('bordeaux-cheap-accessible')
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

  it('filters by cityId (spatial — strict city boundary)', async () => {
    const academy = await createAcademy({ name: 'Académie de Lille' })
    const department = await createDepartment({ academyId: academy.id, code: '59', name: 'Nord' })
    const city = await createCity({
      departmentId: department.id,
      name: 'Lille',
      slug: 'lille',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [3.02, 50.6],
              [3.1, 50.6],
              [3.1, 50.66],
              [3.02, 50.66],
              [3.02, 50.6],
            ],
          ],
        ],
      },
    })

    await createAccommodation({
      slug: 'in-lille',
      geom: { type: 'Point', coordinates: [3.06, 50.63] },
    })
    await createAccommodation({
      slug: 'in-villeneuve-dascq',
      geom: { type: 'Point', coordinates: [3.13, 50.63] },
    })

    const result = await caller.accommodations.list({ cityId: city.id })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('in-lille')
  })

  it('cityId takes priority over bbox', async () => {
    const academy = await createAcademy({ name: 'Académie de Lille 2' })
    const department = await createDepartment({ academyId: academy.id, code: '60', name: 'Nord 2' })
    const city = await createCity({
      departmentId: department.id,
      name: 'Lille 2',
      slug: 'lille-2',
      boundary: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [3.02, 50.6],
              [3.1, 50.6],
              [3.1, 50.66],
              [3.02, 50.66],
              [3.02, 50.6],
            ],
          ],
        ],
      },
    })

    await createAccommodation({
      slug: 'in-city-boundary',
      geom: { type: 'Point', coordinates: [3.06, 50.63] },
    })
    await createAccommodation({
      slug: 'in-bbox-but-outside-city',
      geom: { type: 'Point', coordinates: [3.13, 50.63] },
    })

    // bbox covers both points, but cityId should take priority and only return in-city results
    const result = await caller.accommodations.list({
      cityId: city.id,
      bbox: '2.9,50.5,3.2,50.7',
    })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('in-city-boundary')
  })

  it('cityId with unknown id returns no results', async () => {
    await createAccommodation({
      slug: 'some-accommodation',
      geom: { type: 'Point', coordinates: [3.06, 50.63] },
    })

    const result = await caller.accommodations.list({ cityId: 999999 })
    expect(result.count).toBe(0)
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

  it('filters by ownerSlug', async () => {
    const owner1 = await createOwner({ name: 'Promologis', slug: 'promologis' })
    const owner2 = await createOwner({ name: 'Autre Bailleur', slug: 'autre-bailleur' })

    await createAccommodation({
      slug: 'owned-by-promologis',
      ownerId: owner1.id,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'owned-by-autre',
      ownerId: owner2.id,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'no-owner',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ ownerSlug: 'promologis' })
    expect(result.count).toBe(1)
    expect(result.results.features[0].properties.slug).toBe('owned-by-promologis')
  })

  it('filters by ownerSlug — count and price bounds reflect the filter', async () => {
    const owner = await createOwner({ name: 'Bailleur Prix', slug: 'bailleur-prix' })

    await createAccommodation({
      slug: 'owner-cheap',
      ownerId: owner.id,
      priceMinT1: 200,
      priceMaxT1: 400,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'other-expensive',
      priceMinT1: 800,
      priceMaxT1: 1200,
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ ownerSlug: 'bailleur-prix' })
    expect(result.count).toBe(1)
    expect(result.min_price).toBe(200)
    expect(result.max_price).toBe(400)
  })

  it('falls back to all accommodations when ownerSlug does not match any owner', async () => {
    await createAccommodation({
      slug: 'accom-a',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })
    await createAccommodation({
      slug: 'accom-b',
      geom: { type: 'Point', coordinates: [4.39, 45.44] },
    })

    const result = await caller.accommodations.list({ ownerSlug: 'slug-inexistant' })
    expect(result.count).toBe(2)
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
      accept_dossier_facile_applications: false,
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
