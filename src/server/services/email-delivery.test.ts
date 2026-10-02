import { describe, expect, it } from 'vitest'
import { type EmailCategory, resolveDelivery } from './email-delivery'

const base = {
  category: 'standard' as EmailCategory,
  recipients: ['user@real.com'],
  redirectEmail: 'catchall@test.local',
  bypassRedirect: false,
}

describe('resolveDelivery', () => {
  it('envoie aux destinataires réels en production, sans redirection', () => {
    expect(resolveDelivery({ ...base, appEnv: 'production' })).toEqual({ action: 'send', recipients: ['user@real.com'] })
  })

  it('redirige un email standard hors production', () => {
    expect(resolveDelivery({ ...base, appEnv: 'staging' })).toEqual({ action: 'send', recipients: ['catchall@test.local'] })
    expect(resolveDelivery({ ...base, appEnv: 'development' })).toEqual({ action: 'send', recipients: ['catchall@test.local'] })
  })

  it('collapse plusieurs destinataires vers la seule adresse de redirection', () => {
    const decision = resolveDelivery({ ...base, appEnv: 'staging', recipients: ['a@real.com', 'b@real.com'] })
    expect(decision).toEqual({ action: 'send', recipients: ['catchall@test.local'] })
  })

  it('laisse partir les emails auth au destinataire réel hors production', () => {
    expect(resolveDelivery({ ...base, appEnv: 'staging', category: 'auth' })).toEqual({ action: 'send', recipients: ['user@real.com'] })
  })

  it('renvoie aux destinataires réels quand le bypass est actif hors production', () => {
    expect(resolveDelivery({ ...base, appEnv: 'staging', bypassRedirect: true })).toEqual({ action: 'send', recipients: ['user@real.com'] })
  })

  it("drop + log (fail-safe) quand aucune adresse de redirection n'est configurée", () => {
    const decision = resolveDelivery({ ...base, appEnv: 'staging', redirectEmail: null })
    expect(decision).toEqual({ action: 'drop', reason: 'aucune adresse de redirection configurée' })
  })

  it('en production, envoie réellement même sans adresse de redirection', () => {
    expect(resolveDelivery({ ...base, appEnv: 'production', redirectEmail: null })).toEqual({
      action: 'send',
      recipients: ['user@real.com'],
    })
  })

  it('en production, un email auth part normalement', () => {
    expect(resolveDelivery({ ...base, appEnv: 'production', category: 'auth' })).toEqual({ action: 'send', recipients: ['user@real.com'] })
  })
})
