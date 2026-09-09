import { and, eq, isNull, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactSource } from '~/enums/contact-source'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { createClaimToken, verifyClaimToken } from '~/server/contacts/claim-token'
import { getClaimedContactRequest } from '~/server/contacts/claimed-request'
import { linkGuestContactRequests } from '~/server/contacts/link-guest-requests'
import { purgeContactRequests } from '~/server/contacts/purge'
import { contactRequests } from '~/server/db/schema'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { authenticatedCaller, caller, guestCallerWithIp, ownerCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendContactRequestConfirmationEmail: (...args: unknown[]) => sendConfirmationEmail(...args) }
})

const contactInput = {
  firstname: 'Toto',
  lastname: 'Tutu',
  email: 'tototutu@tete.com',
  phone: '0102030405',
  birthdate: '2003-04-15',
  scholarshipStatus: 'yes',
} as const

/** Fait vieillir une demande pour franchir une fenêtre de rétention sans attendre. */
const ageContactRequest = (id: string, days: number) =>
  getTestDb()
    .update(contactRequests)
    .set({ createdAt: sql`now() - ${`${days} days`}::interval` })
    .where(eq(contactRequests.id, id))

beforeEach(async () => {
  sendConfirmationEmail.mockClear()
  await createUser({ id: 'test-user-id', name: 'Test User', email: 'test@test.com', role: 'user' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
})

describe('contacts.create', () => {
  it('creates a guest contact request without user id', async () => {
    const owner = await createOwner({ name: 'Owner Guest Contacts', slug: 'owner-guest-contacts', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-guest-contact', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])

    const result = await caller.contacts.create({ accommodationSlug: 'res-guest-contact', ...contactInput })

    expect(result).not.toBeNull()
    expect(result!.userId).toBeNull()
    expect(result!.email).toBe(contactInput.email)
    // Un visiteur sans compte n'a que le formulaire pour porter ces informations.
    expect(result!.birthdate).toBe(contactInput.birthdate)
    expect(result!.scholarshipStatus).toBe(contactInput.scholarshipStatus)
  })

  it('rejects when the accommodation has no availability', async () => {
    const owner = await createOwner({ name: 'Owner Contacts', slug: 'owner-contacts', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-no-contact-availability', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 0 })])

    await expect(
      authenticatedCaller.contacts.create({ accommodationSlug: 'res-no-contact-availability', ...contactInput }),
    ).rejects.toThrow("Ce logement n'a pas de disponibilités")
  })

  it('creates a contact request when the accommodation has availability', async () => {
    const owner = await createOwner({
      name: 'Owner Contacts Available',
      slug: 'owner-contacts-available',
      contactMode: EOwnerContactMode.CONTACTS,
    })
    await createAccommodation({ slug: 'res-contact-available', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])

    const result = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-contact-available', ...contactInput })

    expect(result).not.toBeNull()
    expect(result!.userId).toBe('test-user-id')
    // Aucun jeton de rattachement : la demande est déjà liée au compte.
    expect(result!.claimToken).toBeNull()
  })
})

describe('contacts.create — rate limit', () => {
  it('rejects beyond 5 requests per hour from the same IP', async () => {
    const owner = await createOwner({ name: 'Owner Flood', slug: 'owner-flood', contactMode: EOwnerContactMode.CONTACTS })
    for (let i = 0; i < 6; i++) {
      await createAccommodation({ slug: `res-flood-${i}`, ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    }
    const flooder = guestCallerWithIp('203.0.113.42')

    for (let i = 0; i < 5; i++) {
      await flooder.contacts.create({ accommodationSlug: `res-flood-${i}`, ...contactInput, email: `spam${i}@test.com` })
    }

    await expect(flooder.contacts.create({ accommodationSlug: 'res-flood-5', ...contactInput, email: 'spam5@test.com' })).rejects.toThrow(
      /trop de demandes/,
    )
    // La limite est par IP : une autre source n'est pas affectée.
    await expect(
      guestCallerWithIp('198.51.100.7').contacts.create({ accommodationSlug: 'res-flood-5', ...contactInput, email: 'other@test.com' }),
    ).resolves.not.toBeNull()
  })
})

describe('jeton de rattachement', () => {
  it('prefills the sign-up form from the guest request', async () => {
    const owner = await createOwner({ name: 'Owner Claim', slug: 'owner-claim', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-claim', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])

    const request = await caller.contacts.create({ accommodationSlug: 'res-claim', ...contactInput })

    expect(request!.claimToken).toBeTruthy()
    expect(verifyClaimToken(request!.claimToken!)).toBe(request!.id)
    await expect(getClaimedContactRequest(request!.claimToken!)).resolves.toMatchObject({
      firstname: contactInput.firstname,
      email: contactInput.email,
      phone: contactInput.phone,
      birthdate: contactInput.birthdate,
      scholarshipStatus: contactInput.scholarshipStatus,
    })
  })

  it('rejects a forged or tampered token', async () => {
    await expect(getClaimedContactRequest('nimporte.quoi')).resolves.toBeNull()
    await expect(getClaimedContactRequest(undefined)).resolves.toBeNull()
  })
})

describe('candidature et favoris', () => {
  it('adds the accommodation to favorites and reports the application on the favorites list', async () => {
    const owner = await createOwner({ name: 'Owner Fav', slug: 'owner-fav', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-fav', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])

    await authenticatedCaller.contacts.create({ accommodationSlug: 'res-fav', ...contactInput })

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(1)
    expect(favorites[0]!.accommodation.slug).toBe('res-fav')
    expect(favorites[0]!.application).toBe('contact')
  })

  it('reports no application on a favorite the student did not apply to', async () => {
    const owner = await createOwner({ name: 'Owner Plain', slug: 'owner-plain', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-plain', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])

    await authenticatedCaller.favorites.add({ accommodationSlug: 'res-plain' })

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites[0]!.application).toBeNull()
    expect(favorites[0]!.isFavorite).toBe(true)
  })

  it('keeps the accommodation listed with an empty heart once the favorite is removed', async () => {
    const owner = await createOwner({ name: 'Owner Unfav', slug: 'owner-unfav', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-unfav', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    await authenticatedCaller.contacts.create({ accommodationSlug: 'res-unfav', ...contactInput })

    await authenticatedCaller.favorites.remove({ slug: 'res-unfav' })

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(1)
    expect(favorites[0]!.accommodation.slug).toBe('res-unfav')
    // La candidature maintient la résidence dans la liste, mais ce n'est plus un favori.
    expect(favorites[0]!.isFavorite).toBe(false)
    expect(favorites[0]!.application).toBe('contact')
  })

  it('favorites the accommodation when a guest request is linked to the account', async () => {
    const owner = await createOwner({ name: 'Owner Late', slug: 'owner-late', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-late', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    await caller.contacts.create({ accommodationSlug: 'res-late', ...contactInput })

    await linkGuestContactRequests('test-user-id', contactInput.email)

    const favorites = await authenticatedCaller.favorites.list()
    expect(favorites).toHaveLength(1)
    expect(favorites[0]!.accommodation.slug).toBe('res-late')
    expect(favorites[0]!.application).toBe('contact')
  })
})

describe('double opt-in', () => {
  const setup = async (slug: string) => {
    const owner = await createOwner({ name: `Owner ${slug}`, slug: `owner-${slug}`, contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug, ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
  }

  it('leaves a guest request unconfirmed and sends the confirmation email', async () => {
    await setup('res-optin')

    const request = await caller.contacts.create({ accommodationSlug: 'res-optin', ...contactInput })

    expect(request!.confirmedAt).toBeNull()
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(sendConfirmationEmail.mock.calls[0]![0]).toBe(contactInput.email)
  })

  it('confirms a logged-in student request outright, without an email', async () => {
    await setup('res-optin-auth')

    const request = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-optin-auth', ...contactInput })

    expect(request!.confirmedAt).not.toBeNull()
    expect(sendConfirmationEmail).not.toHaveBeenCalled()
  })

  it('rolls the request back when the confirmation email cannot be sent', async () => {
    await setup('res-optin-fail')
    sendConfirmationEmail.mockRejectedValueOnce(new Error('brevo down'))

    await expect(caller.contacts.create({ accommodationSlug: 'res-optin-fail', ...contactInput })).rejects.toThrow(/confirmation/)

    // Sans rollback, l'index unique (résidence, e-mail) bloquerait toute nouvelle tentative.
    const retry = await caller.contacts.create({ accommodationSlug: 'res-optin-fail', ...contactInput })
    expect(retry).not.toBeNull()
  })

  it('refuses a claim token where a confirm token is expected', async () => {
    await setup('res-optin-purpose')
    const request = await caller.contacts.create({ accommodationSlug: 'res-optin-purpose', ...contactInput })

    expect(verifyClaimToken(createClaimToken(request!.id, 'claim'), 'confirm')).toBeNull()
    expect(verifyClaimToken(createClaimToken(request!.id, 'confirm'), 'confirm')).toBe(request!.id)
  })
})

describe('rétention côté gestionnaire', () => {
  const setupOwnedResidence = async (slug: string) => {
    const owner = await createOwner({
      name: `Owner ${slug}`,
      slug: `owner-${slug}`,
      userId: 'test-owner-id',
      contactMode: EOwnerContactMode.CONTACTS,
    })
    await createAccommodation({ slug, ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
  }

  it('shows a recent confirmed request on the board, its counter and its detail', async () => {
    await setupOwnedResidence('res-ret-recent')
    const request = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-ret-recent', ...contactInput })

    const board = await ownerCaller.bailleur.listContactsByResidence({ slug: 'res-ret-recent' })
    expect(board.items).toHaveLength(1)

    const residences = await ownerCaller.bailleur.listResidencesWithContactCounts({})
    expect(residences.residences.find((r) => r.slug === 'res-ret-recent')?.aRappelerCount).toBe(1)

    await expect(ownerCaller.bailleur.getContact({ id: request!.id })).resolves.toBeDefined()
  })

  it('carries the student info of a guest request through to the manager', async () => {
    await setupOwnedResidence('res-info-guest')
    const request = await caller.contacts.create({ accommodationSlug: 'res-info-guest', ...contactInput })
    await getTestDb().update(contactRequests).set({ confirmedAt: new Date() }).where(eq(contactRequests.id, request!.id))

    // Sans compte rattaché, ces informations ne peuvent venir que de la demande elle-même.
    const detail = await ownerCaller.bailleur.getContact({ id: request!.id })
    expect(detail.studentBirthdate).toBe(contactInput.birthdate)
    expect(detail.scholarshipStatus).toBe(contactInput.scholarshipStatus)

    const board = await ownerCaller.bailleur.listContactsByResidence({ slug: 'res-info-guest' })
    expect(board.items[0]!.scholarshipStatus).toBe(contactInput.scholarshipStatus)
  })

  it('hides a request past 30 days everywhere, including by direct URL', async () => {
    await setupOwnedResidence('res-ret-old')
    const request = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-ret-old', ...contactInput })
    await ageContactRequest(request!.id, 31)

    const board = await ownerCaller.bailleur.listContactsByResidence({ slug: 'res-ret-old' })
    expect(board.items).toHaveLength(0)

    const residences = await ownerCaller.bailleur.listResidencesWithContactCounts({})
    expect(residences.residences.find((r) => r.slug === 'res-ret-old')?.aRappelerCount).toBe(0)

    await expect(ownerCaller.bailleur.getContact({ id: request!.id })).rejects.toThrow(/not found/i)
  })

  it('refuses to mutate a request it refuses to show', async () => {
    await setupOwnedResidence('res-ret-mutate')
    const request = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-ret-mutate', ...contactInput })
    await ageContactRequest(request!.id, 31)

    // Lecture et écriture doivent franchir la même porte : un id encore en main ne suffit pas.
    await expect(
      ownerCaller.bailleur.updateContactStatus({ id: request!.id, status: EContactStatus.CONTACTE, source: EContactSource.CONTACT }),
    ).rejects.toThrow(/not found/i)
  })

  it('refuses to mutate an unconfirmed guest request', async () => {
    await setupOwnedResidence('res-ret-mutate-optin')
    const request = await caller.contacts.create({ accommodationSlug: 'res-ret-mutate-optin', ...contactInput })

    await expect(
      ownerCaller.bailleur.updateContactStatus({ id: request!.id, status: EContactStatus.CONTACTE, source: EContactSource.CONTACT }),
    ).rejects.toThrow(/not found/i)
  })

  it('hides a guest request until the double opt-in is confirmed', async () => {
    await setupOwnedResidence('res-ret-optin')
    const request = await caller.contacts.create({ accommodationSlug: 'res-ret-optin', ...contactInput })

    const before = await ownerCaller.bailleur.listContactsByResidence({ slug: 'res-ret-optin' })
    expect(before.items).toHaveLength(0)
    await expect(ownerCaller.bailleur.getContact({ id: request!.id })).rejects.toThrow(/not found/i)

    await getTestDb().update(contactRequests).set({ confirmedAt: new Date() }).where(eq(contactRequests.id, request!.id))

    const after = await ownerCaller.bailleur.listContactsByResidence({ slug: 'res-ret-optin' })
    expect(after.items).toHaveLength(1)
  })
})

describe('purgeContactRequests', () => {
  const createGuestRequest = async (slug: string) => {
    const owner = await createOwner({ name: `Owner ${slug}`, slug: `owner-${slug}`, contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug, ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    return caller.contacts.create({ accommodationSlug: slug, ...contactInput })
  }

  const reload = async (id: string) => {
    const [row] = await getTestDb().select().from(contactRequests).where(eq(contactRequests.id, id))
    return row
  }

  it('deletes guest requests never confirmed after 7 days', async () => {
    const request = await createGuestRequest('res-purge-unconfirmed')
    await ageContactRequest(request!.id, 8)

    const result = await purgeContactRequests()

    expect(result.deleted).toBe(1)
    expect(await reload(request!.id)).toBeUndefined()
  })

  it('keeps a recent unconfirmed request', async () => {
    const request = await createGuestRequest('res-purge-recent')

    const result = await purgeContactRequests()

    expect(result.deleted).toBe(0)
    expect(await reload(request!.id)).toBeDefined()
  })

  it('anonymises requests past 30 days while keeping the row and its history', async () => {
    const owner = await createOwner({ name: 'Owner Old', slug: 'owner-purge-old', contactMode: EOwnerContactMode.CONTACTS })
    const accommodation = await createAccommodation({ slug: 'res-purge-old', ownerId: owner!.id }, [
      typologyDraft('t1', { nbAvailable: 1 }),
    ])
    const request = await authenticatedCaller.contacts.create({ accommodationSlug: 'res-purge-old', ...contactInput })
    await ageContactRequest(request!.id, 31)

    const result = await purgeContactRequests()

    expect(result.anonymized).toBe(1)
    const row = await reload(request!.id)
    expect(row!.email).toBeNull()
    expect(row!.firstname).toBeNull()
    expect(row!.phone).toBeNull()
    expect(row!.birthdate).toBeNull()
    expect(row!.scholarshipStatus).toBeNull()
    expect(row!.ipHash).toBeNull()
    expect(row!.anonymizedAt).not.toBeNull()
    // L'historique survit : qui, où, quand, avec quelle issue.
    expect(row!.userId).toBe('test-user-id')
    expect(row!.accommodationId).toBe(accommodation!.id)
    expect(row!.status).toBeTruthy()
  })

  it('is idempotent — a second run does not re-anonymise', async () => {
    const request = await authenticatedCallerRequest('res-purge-idem')
    await ageContactRequest(request!.id, 31)

    await purgeContactRequests()
    const second = await purgeContactRequests()

    expect(second.anonymized).toBe(0)
  })

  it('lets the student apply again on the same accommodation once anonymised', async () => {
    const request = await createGuestRequest('res-purge-reapply')
    // Confirmée, sinon la première passe la supprimerait au lieu de l'anonymiser.
    await getTestDb().update(contactRequests).set({ confirmedAt: new Date() }).where(eq(contactRequests.id, request!.id))
    await ageContactRequest(request!.id, 31)
    await purgeContactRequests()

    // L'index unique partiel porte sur lower(email) : à NULL, plus de collision.
    const retry = await caller.contacts.create({ accommodationSlug: 'res-purge-reapply', ...contactInput })
    expect(retry).not.toBeNull()
  })

  it('counts without mutating in dry-run', async () => {
    const request = await createGuestRequest('res-purge-dry')
    await ageContactRequest(request!.id, 8)

    const result = await purgeContactRequests({ dryRun: true })

    expect(result.deleted).toBe(1)
    expect(await reload(request!.id)).toBeDefined()
  })
})

const authenticatedCallerRequest = async (slug: string) => {
  const owner = await createOwner({ name: `Owner ${slug}`, slug: `owner-${slug}`, contactMode: EOwnerContactMode.CONTACTS })
  await createAccommodation({ slug, ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
  return authenticatedCaller.contacts.create({ accommodationSlug: slug, ...contactInput })
}

describe('linkGuestContactRequests', () => {
  it('links guest requests sharing the verified email, case-insensitively', async () => {
    const owner = await createOwner({ name: 'Owner Link', slug: 'owner-link', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-link', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    const guest = await caller.contacts.create({ accommodationSlug: 'res-link', ...contactInput })

    const linked = await linkGuestContactRequests('test-user-id', contactInput.email.toUpperCase())

    expect(linked).toBe(1)
    const [row] = await getTestDb().select().from(contactRequests).where(eq(contactRequests.id, guest!.id))
    expect(row!.userId).toBe('test-user-id')
  })

  it('leaves other students guest requests untouched', async () => {
    const owner = await createOwner({ name: 'Owner Other', slug: 'owner-other', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-other', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    const guest = await caller.contacts.create({ accommodationSlug: 'res-other', ...contactInput })

    const linked = await linkGuestContactRequests('test-user-id', 'quelquun-dautre@test.com')

    expect(linked).toBe(0)
    const [row] = await getTestDb().select().from(contactRequests).where(eq(contactRequests.id, guest!.id))
    expect(row!.userId).toBeNull()
  })

  it('drops the guest duplicate when the account already applied on the same accommodation', async () => {
    const owner = await createOwner({ name: 'Owner Dup', slug: 'owner-dup', contactMode: EOwnerContactMode.CONTACTS })
    await createAccommodation({ slug: 'res-dup', ownerId: owner!.id }, [typologyDraft('t1', { nbAvailable: 1 })])
    await authenticatedCaller.contacts.create({ accommodationSlug: 'res-dup', ...contactInput })
    const guest = await caller.contacts.create({ accommodationSlug: 'res-dup', ...contactInput })

    // Sans déduplication, cet UPDATE violerait unique(user_id, accommodation_id) et ferait échouer la connexion.
    const linked = await linkGuestContactRequests('test-user-id', contactInput.email)

    expect(linked).toBe(0)
    const remaining = await getTestDb().select().from(contactRequests).where(eq(contactRequests.id, guest!.id))
    expect(remaining).toHaveLength(0)
    const owned = await getTestDb()
      .select()
      .from(contactRequests)
      .where(and(eq(contactRequests.userId, 'test-user-id'), isNull(contactRequests.reviewedAt)))
    expect(owned).toHaveLength(1)
  })
})
