import { describe, expect, it } from 'vitest'
import { DAY_MS } from '~/utils/time'
import { type AvailabilityResetState, decideAvailabilityReset, decideInactivity, type ResidenceInactivityState } from './inactivity-rules'

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

const decide = (residence: ResidenceInactivityState) => decideInactivity(residence, now, { allowResume: true })

describe('decideInactivity', () => {
  it('ne fait rien sous les seuils', () => {
    expect(decide(state({ pendingSince: daysAgo(13), availabilitySince: daysAgo(29) }))).toEqual({
      clearWarnings: [],
      warn: [],
      suspend: null,
      resume: false,
    })
  })

  it('alerte au 14e jour sans traitement', () => {
    expect(decide(state({ pendingSince: daysAgo(14) })).warn).toEqual(['unprocessed_applications'])
  })

  it('ne suspend jamais sans alerte préalable', () => {
    const decision = decide(state({ pendingSince: daysAgo(25) }))
    expect(decision).toMatchObject({ warn: ['unprocessed_applications'], suspend: null })
  })

  it('suspend 7 jours après l’alerte si rien n’est fait', () => {
    const warnedAt = { unprocessed_applications: daysAgo(7), stale_availability: null }
    expect(decide(state({ pendingSince: daysAgo(21), warnedAt }))).toMatchObject({
      warn: [],
      suspend: 'unprocessed_applications',
    })
  })

  it('laisse les 7 jours de préavis à une résidence déjà très en retard à l’alerte', () => {
    const warnedAt = { unprocessed_applications: daysAgo(6), stale_availability: null }
    expect(decide(state({ pendingSince: daysAgo(40), warnedAt })).suspend).toBeNull()
  })

  it('tolère un cron passé un peu plus tôt que la veille', () => {
    const warnedAt = { unprocessed_applications: hoursAgo(7 * 24 - 1), stale_availability: null }
    expect(decide(state({ pendingSince: daysAgo(21), warnedAt })).suspend).toBe('unprocessed_applications')
  })

  it('suspend si une autre candidature de plus de 14 jours reste à traiter', () => {
    const warnedAt = { unprocessed_applications: daysAgo(7), stale_availability: null }
    expect(decide(state({ pendingSince: daysAgo(15), warnedAt })).suspend).toBe('unprocessed_applications')
  })

  it('alerte à 30 jours sans mise à jour des disponibilités, puis suspend 7 jours après', () => {
    expect(decide(state({ availabilitySince: daysAgo(30) })).warn).toEqual(['stale_availability'])
    const warnedAt = { unprocessed_applications: null, stale_availability: daysAgo(7) }
    expect(decide(state({ availabilitySince: daysAgo(37), warnedAt })).suspend).toBe('stale_availability')
  })

  it('ignore la règle des disponibilités quand elle ne s’applique pas', () => {
    expect(decide(state({ availabilitySince: null })).warn).toEqual([])
  })

  it('efface une alerte dont la cause a disparu', () => {
    const warnedAt = { unprocessed_applications: hoursAgo(24), stale_availability: null }
    expect(decide(state({ pendingSince: null, warnedAt })).clearWarnings).toEqual(['unprocessed_applications'])
  })

  it('reprend une suspension automatique résolue', () => {
    const decision = decide(state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', pendingSince: daysAgo(3) }))
    expect(decision.resume).toBe(true)
  })

  it('reprend puis alerte sur l’autre motif, sans le suspendre d’emblée', () => {
    const decision = decide(
      state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', availabilitySince: daysAgo(40) }),
    )
    expect(decision).toMatchObject({ resume: true, warn: ['stale_availability'], suspend: null })
  })

  it('maintient une suspension automatique tant que la cause persiste', () => {
    const decision = decide(state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', pendingSince: daysAgo(23) }))
    expect(decision).toEqual({ clearWarnings: [], warn: [], suspend: null, resume: false })
  })

  it('ne lève jamais une suspension depuis le cron', () => {
    const decision = decideInactivity(
      state({ suspendedAt: daysAgo(2), suspensionReason: 'unprocessed_applications', pendingSince: null }),
      now,
      { allowResume: false },
    )
    expect(decision).toMatchObject({ resume: false, warn: [], suspend: null })
  })

  it('ne reprend jamais une suspension manuelle', () => {
    expect(decide(state({ suspendedAt: daysAgo(2), suspensionReason: 'manual' })).resume).toBe(false)
  })
})

const resetState = (overrides: Partial<AvailabilityResetState> = {}): AvailabilityResetState => ({
  hasAvailability: true,
  availabilitySince: daysAgo(1),
  warnedAt: null,
  inInactivityScope: false,
  ...overrides,
})

describe('decideAvailabilityReset', () => {
  it('ne fait rien avant 30 jours', () => {
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(29) }), now)).toBeNull()
  })

  it('alerte à 30 jours, puis réinitialise 7 jours après l’alerte', () => {
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(30) }), now)).toBe('warn')
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(36), warnedAt: daysAgo(6) }), now)).toBeNull()
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(37), warnedAt: daysAgo(7) }), now)).toBe('reset')
  })

  it('ne réinitialise jamais sans alerte préalable', () => {
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(90) }), now)).toBe('warn')
  })

  it('lève l’alerte quand les disponibilités ont été confirmées', () => {
    expect(decideAvailabilityReset(resetState({ availabilitySince: daysAgo(2), warnedAt: daysAgo(5) }), now)).toBe('clear')
  })

  it('laisse l’alerte au suivi des candidatures, mais réinitialise à l’échéance', () => {
    const inScope = { inInactivityScope: true, availabilitySince: daysAgo(40) }
    expect(decideAvailabilityReset(resetState(inScope), now)).toBeNull()
    expect(decideAvailabilityReset(resetState({ ...inScope, warnedAt: daysAgo(7) }), now)).toBe('reset')
    expect(decideAvailabilityReset(resetState({ inInactivityScope: true, warnedAt: daysAgo(3) }), now)).toBeNull()
  })

  it('ignore une résidence sans disponibilité renseignée', () => {
    expect(decideAvailabilityReset(resetState({ hasAvailability: false, availabilitySince: daysAgo(90) }), now)).toBeNull()
  })
})
