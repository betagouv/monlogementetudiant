import { describe, expect, it } from 'vitest'
import { floorToStep } from '~/utils/floor-to-step'

describe('floorToStep', () => {
  it('arrondit au millier inférieur', () => {
    expect(floorToStep(69688, 1000)).toBe(69000)
    expect(floorToStep(70999, 1000)).toBe(70000)
  })

  it('arrondit à la centaine inférieure', () => {
    expect(floorToStep(1637, 100)).toBe(1600)
    expect(floorToStep(1699, 100)).toBe(1600)
  })

  it('conserve une valeur déjà ronde', () => {
    expect(floorToStep(70000, 1000)).toBe(70000)
    expect(floorToStep(1600, 100)).toBe(1600)
  })

  it('renvoie 0 sous le pas', () => {
    expect(floorToStep(999, 1000)).toBe(0)
  })

  it('renvoie 0 pour une valeur nulle, négative ou non finie', () => {
    expect(floorToStep(0, 100)).toBe(0)
    expect(floorToStep(-150, 100)).toBe(0)
    expect(floorToStep(Number.NaN, 100)).toBe(0)
    expect(floorToStep(Number.POSITIVE_INFINITY, 100)).toBe(0)
  })

  it('renvoie 0 pour un pas nul ou négatif', () => {
    expect(floorToStep(1637, 0)).toBe(0)
    expect(floorToStep(1637, -100)).toBe(0)
  })
})
