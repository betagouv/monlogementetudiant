import { describe, expect, it } from 'vitest'
import { segmentOwner } from './availability-follow-up'

describe('segmentOwner', () => {
  it('classe en mauvais élève un gestionnaire qui n’a jamais rien renseigné', () => {
    expect(segmentOwner({ recent: 0, stale: 0, missing: 5 })).toBe('bad')
  })

  it('classe en mauvais élève un gestionnaire sans parc', () => {
    expect(segmentOwner({ recent: 0, stale: 0, missing: 0 })).toBe('bad')
  })

  it('classe en bon élève un parc entièrement renseigné et à jour', () => {
    expect(segmentOwner({ recent: 10, stale: 0, missing: 0 })).toBe('good')
  })

  it('classe en bon élève à exactement 80 % de parc à jour', () => {
    expect(segmentOwner({ recent: 8, stale: 2, missing: 0 })).toBe('good')
  })

  it('classe en irrégulier sous les 80 % à jour', () => {
    expect(segmentOwner({ recent: 7, stale: 3, missing: 0 })).toBe('irregular')
  })

  it('classe en irrégulier dès qu’une résidence n’est pas renseignée, même avec un parc à jour', () => {
    expect(segmentOwner({ recent: 9, stale: 0, missing: 1 })).toBe('irregular')
  })

  it('classe en irrégulier un parc renseigné mais jamais à jour', () => {
    expect(segmentOwner({ recent: 0, stale: 4, missing: 0 })).toBe('irregular')
  })
})
