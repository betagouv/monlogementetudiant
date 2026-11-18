import { describe, expect, it } from 'vitest'
import { assertSameDatabase, assertSeedableDatabase } from './run'

describe('assertSeedableDatabase', () => {
  it.each([
    'postgres://mle:mle@localhost:5490/mle_dev',
    'postgres://test:test@localhost:5491/mle_e2e',
    'postgres://test:test@127.0.0.1:5432/mle_test',
  ])('accepte une base locale jetable : %s', (url) => {
    expect(() => assertSeedableDatabase(url)).not.toThrow()
  })

  it('refuse une base distante', () => {
    expect(() => assertSeedableDatabase('postgres://u:p@db.example.com:5432/mle_dev')).toThrow(/locale/)
  })

  it('refuse un tunnel local vers une base distante', () => {
    expect(() => assertSeedableDatabase('postgres://u:p@127.0.0.1:15432/mle_production')).toThrow(/_dev, _e2e ou _test/)
  })

  it('refuse une URL absente', () => {
    expect(() => assertSeedableDatabase(undefined)).toThrow(/DATABASE_URL_TEST/)
  })
})

describe('assertSameDatabase', () => {
  it('accepte deux URL vers la même base, identifiants différents', () => {
    expect(() =>
      assertSameDatabase(new URL('postgres://a:a@localhost:5491/mle_e2e'), new URL('postgres://b:b@localhost:5491/mle_e2e')),
    ).not.toThrow()
  })

  it('refuse deux bases différentes', () => {
    expect(() =>
      assertSameDatabase(new URL('postgres://test:test@localhost:5491/mle_test'), new URL('postgres://mle:mle@localhost:5490/mle_dev')),
    ).toThrow(/bases différentes/)
  })
})
