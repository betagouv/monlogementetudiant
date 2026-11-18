import { describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { captureMonthlyMetrics } from '~/server/admin-metrics/capture'
import { CONTACT_PATH_TARGET, getContactPathSeries, getOwnersToTarget } from '~/server/admin-metrics/contact-path'
import { createAccommodation, createExternalSource, createOwner } from './fixtures/factories'
import './helpers/setup-integration'

const NOW = new Date('2026-11-15T12:00:00Z')

describe('parcours contact', () => {
  it('calcule la part de logements activés hors CROUS et laisse null les mois sans relevé', async () => {
    const activated = await createOwner({ slug: 'active', contactMode: EOwnerContactMode.CONTACTS })
    const inactive = await createOwner({ slug: 'inactif' })
    const crous = await createOwner({ slug: 'crous', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'r-active', ownerId: activated.id, nbTotalApartments: 100, nbAvailableApartments: 5 })
    await createAccommodation({ slug: 'r-inactive', ownerId: inactive.id, nbTotalApartments: 300, nbAvailableApartments: 5 })
    await createAccommodation({ slug: 'r-sans-total', ownerId: inactive.id, nbTotalApartments: null })
    const crousResidence = await createAccommodation({ slug: 'r-crous', ownerId: crous.id, nbTotalApartments: 500 })
    await createExternalSource({ accommodationId: crousResidence.id, source: 'crous' })

    await captureMonthlyMetrics({ now: NOW })
    const months = await getContactPathSeries({ from: '2026-10', to: '2026-11' })

    expect(CONTACT_PATH_TARGET).toBe(0.2)
    expect(months[0]).toEqual({
      month: '2026-10',
      logementsPublies: null,
      logementsActives: null,
      part: null,
      residencesSansTotal: null,
      gestionnairesActives: null,
      gestionnairesAvecDispo: null,
    })
    expect(months[1]).toMatchObject({
      month: '2026-11',
      logementsPublies: 400,
      logementsActives: 100,
      part: 0.25,
      residencesSansTotal: 1,
      gestionnairesActives: 1,
    })
  })

  it('liste les gestionnaires non activés avec des disponibilités hors CROUS', async () => {
    const withAvailability = await createOwner({ slug: 'cible', name: 'Cible' })
    const bigger = await createOwner({ slug: 'cible-grande', name: 'Grande cible' })
    const noAvailability = await createOwner({ slug: 'sans-dispo' })
    const activated = await createOwner({ slug: 'active', contactMode: EOwnerContactMode.CONTACTS })
    const crousOnly = await createOwner({ slug: 'crous-seul' })
    await createAccommodation({ slug: 'a1', ownerId: withAvailability.id, nbAvailableApartments: 2 })
    await createAccommodation({ slug: 'a2', ownerId: withAvailability.id, nbAvailableApartments: 3 })
    await createAccommodation({ slug: 'b1', ownerId: bigger.id, nbAvailableApartments: 10 })
    await createAccommodation({ slug: 'c1', ownerId: noAvailability.id, nbAvailableApartments: 0 })
    await createAccommodation({ slug: 'd1', ownerId: activated.id, nbAvailableApartments: 4 })
    const crousResidence = await createAccommodation({ slug: 'e1', ownerId: crousOnly.id, nbAvailableApartments: 8 })
    await createExternalSource({ accommodationId: crousResidence.id, source: 'crous' })

    expect(await getOwnersToTarget()).toEqual([
      { ownerId: bigger.id, ownerName: 'Grande cible', residencesAvecDispo: 1, logementsDisponibles: 10, contactMode: 'none' },
      { ownerId: withAvailability.id, ownerName: 'Cible', residencesAvecDispo: 2, logementsDisponibles: 5, contactMode: 'none' },
    ])
  })
})
