import { describe, expect, it } from 'vitest'
import { donutArcPath, donutSlices } from '~/server/budget-pdf/donut'

const geometry = { cx: 100, cy: 100, outer: 80, inner: 60 }

describe('donutArcPath', () => {
  it('trace un quart d’anneau depuis midi', () => {
    expect(donutArcPath(100, 100, 80, 60, -Math.PI / 2, 0)).toBe('M 100 20 A 80 80 0 0 1 180 100 L 160 100 A 60 60 0 0 0 100 40 Z')
  })

  it('active le grand arc au-delà d’un demi-tour', () => {
    expect(donutArcPath(100, 100, 80, 60, -Math.PI / 2, Math.PI)).toContain('A 80 80 0 1 1')
  })
})

describe('donutSlices', () => {
  it('enchaîne les parts dans l’ordre en partant de midi', () => {
    const slices = donutSlices(
      [
        { key: 'housing', share: 0.75 },
        { key: 'food', share: 0.25 },
      ],
      geometry,
    )
    expect(slices.map((slice) => slice.key)).toEqual(['housing', 'food'])
    expect(slices[0]?.path.startsWith('M 100 20')).toBe(true)
    expect(slices[1]?.path.startsWith('M 20 100')).toBe(true)
  })

  it('ignore les parts nulles', () => {
    expect(donutSlices([{ key: 'food', share: 0 }], geometry)).toEqual([])
  })

  it('dessine un anneau complet pour une part unique', () => {
    const [slice] = donutSlices([{ key: 'housing', share: 1 }], geometry)
    expect(slice?.path.match(/M /g)).toHaveLength(2)
    expect(slice?.path).not.toContain('NaN')
  })
})
