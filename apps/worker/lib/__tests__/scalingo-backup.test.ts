import { afterEach, describe, expect, it } from 'vitest'
import { env } from '~/server/env'
import { ScalingoBackupService } from '../scalingo-backup'

const original = { ...env }

afterEach(() => {
  Object.assign(env, original)
})

describe('ScalingoBackupService.app', () => {
  it('sauvegarde la base de SCALINGO_DATABASE_APP quand elle est renseignée (app worker sans addon)', () => {
    Object.assign(env, { SCALINGO_API_TOKEN: 'tk', SCALINGO_APP: 'mle-worker', SCALINGO_DATABASE_APP: 'mle-prod' })
    expect(new ScalingoBackupService().app).toBe('mle-prod')
  })

  it('retombe sur SCALINGO_APP sinon', () => {
    Object.assign(env, { SCALINGO_API_TOKEN: 'tk', SCALINGO_APP: 'mle-prod', SCALINGO_DATABASE_APP: undefined })
    expect(new ScalingoBackupService().app).toBe('mle-prod')
  })
})
