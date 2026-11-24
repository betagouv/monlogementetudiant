import { describe, expect, it } from 'vitest'
import { getAvailabilityStatus } from '~/utils/availability-status'

describe('getAvailabilityStatus', () => {
  it('distingue disponible, complet et non renseigné', () => {
    expect(getAvailabilityStatus(3)).toBe('available')
    expect(getAvailabilityStatus(0)).toBe('none')
    expect(getAvailabilityStatus(null)).toBe('unknown')
    expect(getAvailabilityStatus(undefined)).toBe('unknown')
  })
})
