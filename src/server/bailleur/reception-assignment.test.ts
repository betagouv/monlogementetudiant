import { describe, expect, it } from 'vitest'
import { nextManagerAssignment } from './reception-assignment'

const owner = [1, 2, 3, 4]

describe('nextManagerAssignment', () => {
  it('retire le droit sans toucher au périmètre quand le gestionnaire n’est sélectionné nulle part', () => {
    expect(
      nextManagerAssignment({ scope: { restricted: false }, selectedIn: [], removedFrom: [1, 2], ownerAccommodationIds: owner }),
    ).toEqual({ applicationsEnabled: false, scope: null })
  })

  it('garde « toutes » quand il est sélectionné sur toutes les résidences cochées', () => {
    expect(
      nextManagerAssignment({ scope: { restricted: false }, selectedIn: [1, 2], removedFrom: [], ownerAccommodationIds: owner }),
    ).toEqual({ applicationsEnabled: true, scope: null })
  })

  it('passe « toutes » en restreint, moins les résidences retirées', () => {
    expect(
      nextManagerAssignment({ scope: { restricted: false }, selectedIn: [1], removedFrom: [2], ownerAccommodationIds: owner }),
    ).toEqual({ applicationsEnabled: true, scope: { mode: 'restricted', accommodationIds: [1, 3, 4] } })
  })

  it('complète un périmètre restreint et conserve les résidences non cochées', () => {
    expect(
      nextManagerAssignment({
        scope: { restricted: true, accommodationIds: [4, 2] },
        selectedIn: [1],
        removedFrom: [2],
        ownerAccommodationIds: owner,
      }),
    ).toEqual({ applicationsEnabled: true, scope: { mode: 'restricted', accommodationIds: [1, 4] } })
  })

  it('signale un périmètre restreint inchangé', () => {
    expect(
      nextManagerAssignment({
        scope: { restricted: true, accommodationIds: [1, 3] },
        selectedIn: [1],
        removedFrom: [2],
        ownerAccommodationIds: owner,
      }),
    ).toEqual({ applicationsEnabled: true, scope: null })
  })
})
