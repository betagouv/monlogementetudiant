import { describe, expect, it } from 'vitest'
import { safeCallbackPath } from './safe-callback-path'

describe('safeCallbackPath', () => {
  it('accepte un chemin interne sous le préfixe', () => {
    expect(safeCallbackPath('/bailleur/disponibilites/confirmer?x=1', '/bailleur/')).toBe('/bailleur/disponibilites/confirmer?x=1')
  })

  it('refuse ce qui sort du préfixe ou du site', () => {
    for (const value of [
      '/administration',
      'https://evil.test/bailleur/',
      '//evil.test/bailleur/',
      '/\\evil.test',
      '/bailleur/\n',
      null,
      undefined,
      42,
    ]) {
      expect(safeCallbackPath(value, '/bailleur/')).toBeNull()
    }
    expect(safeCallbackPath('//evil.test')).toBeNull()
  })
})
