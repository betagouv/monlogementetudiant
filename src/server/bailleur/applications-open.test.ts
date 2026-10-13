import { describe, expect, it } from 'vitest'
import { acceptsContactRequests } from './applications-open'

describe('acceptsContactRequests', () => {
  it.each([
    [3, false, true],
    [3, null, true],
    [3, true, true],
    [0, true, true],
    [0, false, false],
    [0, null, false],
    [null, true, true],
    [null, false, false],
    [null, null, false],
  ])('dispos=%s, liste d’attente=%s → %s', (nbAvailableApartments, acceptWaitingList, expected) => {
    expect(acceptsContactRequests({ nbAvailableApartments, acceptWaitingList })).toBe(expected)
  })
})
