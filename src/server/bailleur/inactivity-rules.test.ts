import { describe, expect, it } from 'vitest'
import { DAY_MS } from '~/utils/time'
import { decideInactivity, type ResidenceInactivityState } from './inactivity-rules'

const now = new Date('2026-09-28T06:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000)

const state = (overrides: Partial<ResidenceInactivityState> = {}): ResidenceInactivityState => ({
  pendingSince: null,
  availabilitySince: daysAgo(1),
  warnedAt: { unprocessed_applications: null, stale_availability: null },
  suspendedAt: null,
  suspensionReason: null,
  ...overrides,
})

describe('decideInactivity', () => {
  it('ne fait rien sous les seuils', () => {
    expect(decideInactivity(state({ pendingSince: daysAgo(6) }), now)).toEqual({
      clearWarnings: [],
      warn: [],
      suspend: null,
      resume: false,
    })
  })

  it('alerte au 7e jour sans traitement', () => {
    expect(decideInactivity(state({ pendingSince: daysAgo(7) }), now).warn).toEqual(['unprocessed_applications'])
  })

  it('ne suspend jamais sans alerte préalable', () => {
    const decision = decideInactivity(state({ pendingSince: daysAgo(15) }), now)
    expect(decision).toMatchObject({ warn: ['unprocessed_applications'], suspend: null })
  })

  it('suspend au 10e jour, 3 jours après l’alerte', () => {
    const warnedAt = { unprocessed_applications: daysAgo(3), stale_availability: null }
    expect(decideInactivity(state({ pendingSince: daysAgo(10), warnedAt }), now)).toMatchObject({
      warn: [],
      suspend: 'unprocessed_applications',
    })
  })

  it('laisse tout le préavis à une résidence déjà en retard à la première alerte', () => {
    const warnedAt = { unprocessed_applications: daysAgo(1), stale_availability: null }
    expect(decideInactivity(state({ pendingSince: daysAgo(20), warnedAt }), now).suspend).toBeNull()
  })

  it('tolère un cron passé un peu plus tôt que la veille', () => {
    const warnedAt = { unprocessed_applications: hoursAgo(3 * 24 - 1), stale_availability: null }
    expect(decideInactivity(state({ pendingSince: daysAgo(10), warnedAt }), now).suspend).toBe('unprocessed_applications')
  })

  it('alerte à 23 jours et suspend à 30 jours sans mise à jour des disponibilités', () => {
    expect(decideInactivity(state({ availabilitySince: daysAgo(23) }), now).warn).toEqual(['stale_availability'])
    const warnedAt = { unprocessed_applications: null, stale_availability: daysAgo(7) }
    expect(decideInactivity(state({ availabilitySince: daysAgo(30), warnedAt }), now).suspend).toBe('stale_availability')
  })

  it('ignore la règle des disponibilités quand elle ne s’applique pas', () => {
    expect(decideInactivity(state({ availabilitySince: null }), now).warn).toEqual([])
  })

  it('efface une alerte dont la cause a disparu', () => {
    const warnedAt = { unprocessed_applications: hoursAgo(24), stale_availability: null }
    expect(decideInactivity(state({ pendingSince: null, warnedAt }), now).clearWarnings).toEqual(['unprocessed_applications'])
  })

  it('reprend une suspension automatique résolue', () => {
    const decision = decideInactivity(
      state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', pendingSince: daysAgo(3) }),
      now,
    )
    expect(decision.resume).toBe(true)
  })

  it('maintient une suspension automatique tant que la cause persiste', () => {
    const decision = decideInactivity(
      state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', pendingSince: daysAgo(14) }),
      now,
    )
    expect(decision).toEqual({ clearWarnings: [], warn: [], suspend: null, resume: false })
  })

  it('ne reprend jamais une suspension manuelle', () => {
    expect(decideInactivity(state({ suspendedAt: daysAgo(2), suspensionReason: 'manual' }), now).resume).toBe(false)
  })
})
