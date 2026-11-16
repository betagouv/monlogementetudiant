import { describe, expect, it } from 'vitest'
import { envSchema } from './env'

const parseSkip = (value: string | undefined) =>
  envSchema.pick({ SKIP_POSTDEPLOY_MIGRATE: true }).safeParse(value === undefined ? {} : { SKIP_POSTDEPLOY_MIGRATE: value })

describe('SKIP_POSTDEPLOY_MIGRATE', () => {
  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
  ])('%s → %s', (value, expected) => {
    const result = parseSkip(value)
    expect(result.success && result.data.SKIP_POSTDEPLOY_MIGRATE).toBe(expected)
  })

  it.each(['TRUE', 'yes', '1'])('rejette %s', (value) => {
    expect(parseSkip(value).success).toBe(false)
  })
})
