import { describe, expect, it } from 'vitest'
import { segmentOwner } from '~/server/admin-metrics/segment'

describe('segmentOwner', () => {
  it('classe en mauvais élève dès qu une suspension existe', () => {
    expect(segmentOwner({ aTraiter: 0, traites: 0, alertes: 0, suspensions: 1 })).toBe('mauvais_eleve')
    expect(segmentOwner({ aTraiter: 3, traites: 3, alertes: 0, suspensions: 1 })).toBe('mauvais_eleve')
  })

  it('classe en non concerné sans contact à traiter', () => {
    expect(segmentOwner({ aTraiter: 0, traites: 0, alertes: 2, suspensions: 0 })).toBe('non_concerne')
  })

  it('classe en mauvais élève quand rien n est traité', () => {
    expect(segmentOwner({ aTraiter: 2, traites: 0, alertes: 0, suspensions: 0 })).toBe('mauvais_eleve')
  })

  it('classe en irrégulier avec une alerte', () => {
    expect(segmentOwner({ aTraiter: 3, traites: 3, alertes: 1, suspensions: 0 })).toBe('irregulier')
  })

  it('classe en bon élève sinon', () => {
    expect(segmentOwner({ aTraiter: 3, traites: 2, alertes: 0, suspensions: 0 })).toBe('bon_eleve')
  })
})
