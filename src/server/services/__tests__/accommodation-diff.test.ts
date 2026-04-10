import { describe, expect, it } from 'vitest'
import { classifyActions, computeDiff } from '../accommodation-diff'

describe('computeDiff', () => {
  it('detects a single changed field', () => {
    const snapshot = { name: 'Old', description: 'Desc', published: true }
    const updated = { name: 'Old', description: 'Desc', virtualTourUrl: 'https://tour.com' }
    const keys = new Set(['virtualTourUrl'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual(['virtualTourUrl'])
    expect(diff.virtualTourUrl).toEqual({ old: undefined, new: 'https://tour.com' })
  })

  it('detects multiple changed fields', () => {
    const snapshot = { name: 'Old', description: 'Old desc' }
    const updated = { name: 'New', description: 'New desc' }
    const keys = new Set(['name', 'description'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff).sort()).toEqual(['description', 'name'])
    expect(diff.name).toEqual({ old: 'Old', new: 'New' })
    expect(diff.description).toEqual({ old: 'Old desc', new: 'New desc' })
  })

  it('ignores fields not in userProvidedKeys', () => {
    const snapshot = { name: 'Old', nbTotalApartments: 10 }
    const updated = { name: 'Old', nbTotalApartments: 20, virtualTourUrl: 'https://tour.com' }
    const keys = new Set(['virtualTourUrl'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual(['virtualTourUrl'])
    expect(diff).not.toHaveProperty('nbTotalApartments')
  })

  it('ignores DIFF_IGNORE fields (city, cityId, geom, updatedAt)', () => {
    const snapshot = { city: 'Paris' }
    const updated = { city: 'Lyon', cityId: 42, geom: 'point', updatedAt: new Date() }
    const keys = new Set(['city', 'cityId', 'geom', 'updatedAt'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual([])
  })

  it('returns empty diff when values are identical', () => {
    const snapshot = { name: 'Same', description: 'Same' }
    const updated = { name: 'Same', description: 'Same' }
    const keys = new Set(['name', 'description'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual([])
  })

  it('uses deep comparison for arrays', () => {
    const urls = ['https://a.com/img.jpg', 'https://b.com/img.jpg']
    const snapshot = { imagesUrls: urls }
    const updated = { imagesUrls: [...urls] }
    const keys = new Set(['imagesUrls'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual([])
  })

  it('detects array changes', () => {
    const snapshot = { imagesUrls: ['a.jpg'] }
    const updated = { imagesUrls: ['a.jpg', 'b.jpg'] }
    const keys = new Set(['imagesUrls'])

    const diff = computeDiff(snapshot, updated, keys)

    expect(Object.keys(diff)).toEqual(['imagesUrls'])
  })
})

describe('classifyActions', () => {
  it('returns empty array when diff is empty', () => {
    expect(classifyActions({})).toEqual([])
  })

  it('classifies regular field changes as accommodation.updated', () => {
    const diff = { name: { old: 'Old', new: 'New' } }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('accommodation.updated')
    expect(actions[0].diff).toEqual({ name: { old: 'Old', new: 'New' } })
  })

  it('classifies published=true as accommodation.published', () => {
    const diff = { published: { old: false, new: true } }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('accommodation.published')
  })

  it('classifies published=false as accommodation.unpublished', () => {
    const diff = { published: { old: true, new: false } }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('accommodation.unpublished')
  })

  it('classifies availability-only changes as accommodation.availability_updated', () => {
    const diff = {
      nbT1Available: { old: 5, new: 6 },
      nbT2Available: { old: 0, new: 2 },
    }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(1)
    expect(actions[0].action).toBe('accommodation.availability_updated')
    expect(Object.keys(actions[0].diff).sort()).toEqual(['nbT1Available', 'nbT2Available'])
  })

  it('splits published + availability into separate actions', () => {
    const diff = {
      published: { old: false, new: true },
      nbT1Available: { old: 0, new: 3 },
    }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(2)
    expect(actions.map((a) => a.action).sort()).toEqual(['accommodation.availability_updated', 'accommodation.published'])
    expect(actions.find((a) => a.action === 'accommodation.published')!.diff).toEqual({
      published: { old: false, new: true },
    })
    expect(actions.find((a) => a.action === 'accommodation.availability_updated')!.diff).toEqual({
      nbT1Available: { old: 0, new: 3 },
    })
  })

  it('splits published + availability + other into 3 actions', () => {
    const diff = {
      published: { old: false, new: true },
      nbT1Available: { old: 0, new: 3 },
      name: { old: 'Old', new: 'New' },
    }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(3)
    expect(actions.map((a) => a.action).sort()).toEqual([
      'accommodation.availability_updated',
      'accommodation.published',
      'accommodation.updated',
    ])
  })

  it('keeps availability and regular changes separate', () => {
    const diff = {
      name: { old: 'Old', new: 'New' },
      nbT1Available: { old: 5, new: 6 },
    }
    const actions = classifyActions(diff)

    expect(actions).toHaveLength(2)
    expect(actions.find((a) => a.action === 'accommodation.updated')!.diff).toEqual({
      name: { old: 'Old', new: 'New' },
    })
    expect(actions.find((a) => a.action === 'accommodation.availability_updated')!.diff).toEqual({
      nbT1Available: { old: 5, new: 6 },
    })
  })
})
