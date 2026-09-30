import { describe, expect, it } from 'vitest'
import { digestRecipients, digestWindow, formatDigestDate, groupByRecipient } from './contact-digest'
import type { Member } from './inactivity-suspension'

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'u1',
  email: 'u1@test.local',
  firstname: 'Test',
  ownerId: 1,
  bailleurRole: 'administrator',
  bailleurPermissions: [],
  scope: null,
  ...overrides,
})

describe('digestWindow', () => {
  it('couvre la veille en jour civil Europe/Paris (heure d’hiver, UTC+1)', () => {
    // 26 janvier 2026 08:00 Paris = 07:00 UTC
    const { start, end } = digestWindow(new Date('2026-01-26T07:00:00Z'))
    expect(start.toISOString()).toBe('2026-01-24T23:00:00.000Z') // 25 janv. 00:00 Paris
    expect(end.toISOString()).toBe('2026-01-25T23:00:00.000Z') // 26 janv. 00:00 Paris
  })

  it('couvre la veille en jour civil Europe/Paris (heure d’été, UTC+2)', () => {
    // 25 septembre 2026 08:00 Paris = 06:00 UTC
    const { start, end } = digestWindow(new Date('2026-09-25T06:00:00Z'))
    expect(start.toISOString()).toBe('2026-09-23T22:00:00.000Z') // 24 sept. 00:00 Paris
    expect(end.toISOString()).toBe('2026-09-24T22:00:00.000Z') // 25 sept. 00:00 Paris
  })

  it('reste sur la veille au passage à l’heure d’été (jour de 23h)', () => {
    // 30 mars 2026 08:00 Paris (lendemain du passage à l'heure d'été du 29 mars)
    const { start, end } = digestWindow(new Date('2026-03-30T06:00:00Z'))
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z') // 29 mars 00:00 Paris (UTC+1)
    expect(end.toISOString()).toBe('2026-03-29T22:00:00.000Z') // 30 mars 00:00 Paris (UTC+2)
  })
})

describe('formatDigestDate', () => {
  it('formate en « jeudi 24 septembre » (formulation validée sur Notion)', () => {
    expect(formatDigestDate(new Date('2026-09-23T22:00:00Z'))).toBe('jeudi 24 septembre')
  })
})

describe('digestRecipients', () => {
  const residence = { accommodationId: 10, ownerId: 1 }

  it('inclut les administrateurs du bailleur', () => {
    const admins = digestRecipients([member()], residence)
    expect(admins).toHaveLength(1)
  })

  it('exclut les membres d’un autre bailleur', () => {
    expect(digestRecipients([member({ ownerId: 2 })], residence)).toHaveLength(0)
  })

  it('inclut le gestionnaire autorisé dont le périmètre couvre la résidence', () => {
    const g = member({ bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'], scope: new Set([10]) })
    expect(digestRecipients([g], residence)).toHaveLength(1)
  })

  it('exclut le gestionnaire hors périmètre ou sans permission', () => {
    const horsPerimetre = member({ bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'], scope: new Set([99]) })
    const sansPermission = member({ bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'], scope: null })
    expect(digestRecipients([horsPerimetre, sansPermission], residence)).toHaveLength(0)
  })
})

describe('groupByRecipient', () => {
  it('groupe les résidences par destinataire avec total, triées par nom', () => {
    const admin = member()
    const residences = [
      { accommodationId: 11, name: 'Oméga', ownerId: 1, count: 2 },
      { accommodationId: 10, name: 'Alpha', ownerId: 1, count: 3 },
    ]

    const grouped = groupByRecipient(residences, [admin])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].totalCount).toBe(5)
    expect(grouped[0].residences.map((r) => r.name)).toEqual(['Alpha', 'Oméga'])
  })

  it('ne montre à un gestionnaire restreint que les résidences de son périmètre', () => {
    const g = member({ id: 'g1', bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'], scope: new Set([10]) })
    const residences = [
      { accommodationId: 10, name: 'Alpha', ownerId: 1, count: 1 },
      { accommodationId: 11, name: 'Oméga', ownerId: 1, count: 4 },
    ]

    const grouped = groupByRecipient(residences, [g])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].residences).toEqual([{ name: 'Alpha', count: 1 }])
    expect(grouped[0].totalCount).toBe(1)
  })

  it('ne produit personne quand aucune résidence', () => {
    expect(groupByRecipient([], [member()])).toHaveLength(0)
  })
})
