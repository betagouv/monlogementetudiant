import { describe, expect, it } from 'vitest'
import { envSchema, parseEnv, WEB_ONLY_ENV } from './env'

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

const withoutWebOnly = () => {
  const source: NodeJS.ProcessEnv = { ...process.env }
  for (const key of WEB_ONLY_ENV) delete source[key]
  return source
}

describe('parseEnv', () => {
  it('accepte l’absence des variables réservées au web dans le worker', () => {
    expect(() => parseEnv(withoutWebOnly(), 'worker')).not.toThrow()
    expect(() => parseEnv(withoutWebOnly(), 'cli')).not.toThrow()
  })

  it('exige les variables réservées au web côté web', () => {
    expect(() => parseEnv(withoutWebOnly(), 'web')).toThrow(/WP_FAQ_URL/)
  })

  it('exige toujours les variables dont le worker a besoin', () => {
    const source = withoutWebOnly()
    delete source.BREVO_API_KEY
    expect(() => parseEnv(source, 'worker')).toThrow(/BREVO_API_KEY/)
  })

  it('refuse bruyamment la lecture d’une variable réservée au web dans le worker', () => {
    const env = parseEnv(withoutWebOnly(), 'worker')
    expect(() => env.WP_FAQ_URL).toThrow('WP_FAQ_URL réservée à l’app web')
    expect(env.BREVO_API_KEY).toBe(process.env.BREVO_API_KEY)
  })
})
