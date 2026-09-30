import { describe, expect, it } from 'vitest'
import { diffResidenceSelection } from './application-notifications'

const r = (id: number, name: string) => ({ id, name })

describe('diffResidenceSelection', () => {
  it('retourne les résidences désactivées (présentes avant, absentes après)', () => {
    const before = [r(1, 'Alpha'), r(2, 'Beta'), r(3, 'Gamma')]
    const after = [r(2, 'Beta')]

    expect(diffResidenceSelection(before, after)).toEqual({
      deactivated: ['Alpha', 'Gamma'],
      activated: [],
    })
  })

  it('retourne les résidences réactivées (absentes avant, présentes après)', () => {
    const before = [r(2, 'Beta')]
    const after = [r(1, 'Alpha'), r(2, 'Beta')]

    expect(diffResidenceSelection(before, after)).toEqual({
      deactivated: [],
      activated: ['Alpha'],
    })
  })

  it('combine désactivations et réactivations dans un même enregistrement', () => {
    const before = [r(1, 'Alpha'), r(2, 'Beta')]
    const after = [r(2, 'Beta'), r(3, 'Gamma')]

    expect(diffResidenceSelection(before, after)).toEqual({
      deactivated: ['Alpha'],
      activated: ['Gamma'],
    })
  })

  it('retourne des deltas vides quand la sélection est inchangée', () => {
    const selection = [r(1, 'Alpha'), r(2, 'Beta')]

    expect(diffResidenceSelection(selection, [...selection])).toEqual({
      deactivated: [],
      activated: [],
    })
  })

  it('gère une sélection initialement vide', () => {
    expect(diffResidenceSelection([], [r(1, 'Alpha')])).toEqual({
      deactivated: [],
      activated: ['Alpha'],
    })
  })
})
