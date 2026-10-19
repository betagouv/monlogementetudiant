import { describe, expect, it } from 'vitest'
import { nextManagerAssignment } from './reception-assignment'

describe('nextManagerAssignment', () => {
  it('retire le droit sans toucher au périmètre quand le gestionnaire n’est sélectionné nulle part', () => {
    expect(nextManagerAssignment({ scope: { restricted: false }, selectedIn: [], removedFrom: [1, 2] })).toEqual({
      applicationsEnabled: false,
      scope: null,
    })
  })

  it('garde « toutes » quand il est sélectionné sur toutes les résidences cochées', () => {
    expect(nextManagerAssignment({ scope: { restricted: false }, selectedIn: [1, 2], removedFrom: [] })).toEqual({
      applicationsEnabled: true,
      scope: null,
    })
  })

  it('restreint « toutes » aux seules résidences où il est sélectionné', () => {
    expect(nextManagerAssignment({ scope: { restricted: false }, selectedIn: [1], removedFrom: [2] })).toEqual({
      applicationsEnabled: true,
      scope: { mode: 'restricted', accommodationIds: [1] },
    })
  })

  it('remplace un périmètre restreint, résidences non cochées comprises', () => {
    expect(nextManagerAssignment({ scope: { restricted: true, accommodationIds: [4, 2] }, selectedIn: [3, 1], removedFrom: [2] })).toEqual({
      applicationsEnabled: true,
      scope: { mode: 'restricted', accommodationIds: [1, 3] },
    })
  })

  it('signale un périmètre restreint inchangé', () => {
    expect(nextManagerAssignment({ scope: { restricted: true, accommodationIds: [3, 1] }, selectedIn: [1, 3], removedFrom: [2] })).toEqual({
      applicationsEnabled: true,
      scope: null,
    })
  })
})
