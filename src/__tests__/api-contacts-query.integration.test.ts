import { describe, expect, it } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getOwnerContact, listOwnerContacts, type TContactsFilters } from '~/server/api/v1/contacts-query'
import { contactRequests } from '~/server/db/schema'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

const filters = (overrides: Partial<TContactsFilters> = {}): TContactsFilters => ({
  includePurged: false,
  page: 1,
  pageSize: 20,
  order: 'desc',
  ...overrides,
})

type ContactInsert = typeof contactRequests.$inferInsert

async function insertContact(values: ContactInsert) {
  const [row] = await getTestDb().insert(contactRequests).values(values).returning()
  return row
}

let ownerCounter = 0

async function seedOwner(overrides: { contactMode?: EOwnerContactMode; externalReference?: string; slug?: string } = {}) {
  ownerCounter += 1
  const owner = await createOwner({
    name: `Bailleur ${ownerCounter}`,
    slug: `bailleur-api-${ownerCounter}`,
    contactMode: overrides.contactMode ?? EOwnerContactMode.CONTACTS,
  })
  const residence = await createAccommodation({
    name: `Résidence ${ownerCounter}`,
    ownerId: owner.id,
    externalReference: overrides.externalReference ?? null,
    ...(overrides.slug ? { slug: overrides.slug } : {}),
  })
  return { owner, residence }
}

const guestContact = (accommodationId: number, overrides: Partial<ContactInsert> = {}): ContactInsert => ({
  accommodationId,
  firstname: 'Camille',
  lastname: 'Martin',
  email: `camille-${Math.random()}@test.fr`,
  phone: '0601020304',
  confirmedAt: daysAgo(1),
  createdAt: daysAgo(1),
  updatedAt: daysAgo(1),
  ...overrides,
})

describe('listOwnerContacts', () => {
  it('ne renvoie que les demandes du bailleur', async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const mine = await insertContact(guestContact(a.residence.id))
    await insertContact(guestContact(b.residence.id))

    const { count, results } = await listOwnerContacts(a.owner.id, filters())
    expect(count).toBe(1)
    expect(results.map((r) => r.id)).toEqual([mine.id])
    expect(results[0].residence).toEqual({ slug: a.residence.slug, name: a.residence.name, externalReference: null })
    expect(results[0].student).toMatchObject({ firstname: 'Camille', lastname: 'Martin', phone: '0601020304' })
    expect(results[0].purged).toBe(false)
  })

  it('exclut les demandes non confirmées', async () => {
    const { owner, residence } = await seedOwner()
    await insertContact(guestContact(residence.id, { confirmedAt: null }))

    const { count, results } = await listOwnerContacts(owner.id, filters())
    expect(count).toBe(0)
    expect(results).toEqual([])
  })

  it('exclut les demandes de plus de 30 jours par défaut', async () => {
    const { owner, residence } = await seedOwner()
    await insertContact(guestContact(residence.id, { createdAt: daysAgo(31), confirmedAt: daysAgo(31) }))

    const { count, results } = await listOwnerContacts(owner.id, filters())
    expect(count).toBe(0)
    expect(results).toEqual([])
  })

  it('include_purged : demande de 31 jours liée à un compte, non anonymisée → purged true, student null, purgedAt null', async () => {
    const { owner, residence } = await seedOwner()
    await createUser({ id: 'student-old', email: 'ancien@test.fr', name: 'Ancien Étudiant', phone: '0700000000' })
    const old = await insertContact({
      accommodationId: residence.id,
      userId: 'student-old',
      firstname: 'Ancien',
      lastname: 'Étudiant',
      email: 'ancien@test.fr',
      createdAt: daysAgo(31),
    })

    const { count, results } = await listOwnerContacts(owner.id, filters({ includePurged: true }))
    expect(count).toBe(1)
    expect(results[0]).toMatchObject({ id: old.id, purged: true, purgedAt: null, student: null })
    expect(JSON.stringify(results[0])).not.toContain('ancien@test.fr')
    expect(JSON.stringify(results[0])).not.toContain('Ancien')
  })

  it('include_purged : demande anonymisée → purged true, purgedAt = anonymizedAt', async () => {
    const { owner, residence } = await seedOwner()
    await createUser({ id: 'student-anon', email: 'anon@test.fr', name: 'Compte Anonymisé' })
    const anonymizedAt = daysAgo(2)
    await insertContact({
      accommodationId: residence.id,
      userId: 'student-anon',
      anonymizedAt,
      createdAt: daysAgo(40),
    })

    const { results } = await listOwnerContacts(owner.id, filters({ includePurged: true }))
    expect(results).toHaveLength(1)
    expect(results[0].purged).toBe(true)
    expect(results[0].student).toBeNull()
    expect(results[0].purgedAt?.getTime()).toBe(anonymizedAt.getTime())
    expect(JSON.stringify(results[0])).not.toContain('anon@test.fr')
  })

  it('demande récente liée à un compte sans coordonnées propres → e-mail du compte', async () => {
    const { owner, residence } = await seedOwner()
    await createUser({ id: 'student-recent', email: 'compte@test.fr', name: 'Nom Complet', phone: '0611111111', studyYear: 'bac_2' })
    await insertContact({ accommodationId: residence.id, userId: 'student-recent', createdAt: daysAgo(1) })

    const { results } = await listOwnerContacts(owner.id, filters())
    expect(results).toHaveLength(1)
    expect(results[0].purged).toBe(false)
    expect(results[0].student).toMatchObject({
      firstname: null,
      lastname: 'Nom Complet',
      email: 'compte@test.fr',
      phone: '0611111111',
      studyYear: 'bac_2',
    })
  })

  it('bailleur en mode dossier_facile → count 0', async () => {
    const { owner, residence } = await seedOwner({ contactMode: EOwnerContactMode.DOSSIER_FACILE })
    await insertContact(guestContact(residence.id))

    const { count, results } = await listOwnerContacts(owner.id, filters())
    expect(count).toBe(0)
    expect(results).toEqual([])
  })

  it('filtre residence (slug) et externalReference ; même référence externe chez un autre bailleur → ignorée', async () => {
    const a = await seedOwner({ externalReference: 'REF-1' })
    const second = await createAccommodation({ name: 'Autre résidence', ownerId: a.owner.id, externalReference: 'REF-2' })
    const b = await seedOwner({ externalReference: 'REF-1' })
    const inFirst = await insertContact(guestContact(a.residence.id))
    const inSecond = await insertContact(guestContact(second.id))
    await insertContact(guestContact(b.residence.id))

    const bySlug = await listOwnerContacts(a.owner.id, filters({ residence: second.slug }))
    expect(bySlug.results.map((r) => r.id)).toEqual([inSecond.id])
    expect(bySlug.count).toBe(1)

    const byRef = await listOwnerContacts(a.owner.id, filters({ externalReference: 'REF-1' }))
    expect(byRef.results.map((r) => r.id)).toEqual([inFirst.id])
    expect(byRef.count).toBe(1)
    expect(byRef.results[0].residence.externalReference).toBe('REF-1')

    const foreignSlug = await listOwnerContacts(a.owner.id, filters({ residence: b.residence.slug }))
    expect(foreignSlug).toEqual({ count: 0, results: [] })

    const unknownRef = await listOwnerContacts(a.owner.id, filters({ externalReference: 'INCONNUE' }))
    expect(unknownRef).toEqual({ count: 0, results: [] })
  })

  it('filtre statuses multiple ; createdSince/createdUntil ; updatedSince', async () => {
    const { owner, residence } = await seedOwner()
    const contacted = await insertContact(
      guestContact(residence.id, { status: EContactStatus.CONTACTE, createdAt: daysAgo(10), updatedAt: daysAgo(1) }),
    )
    const attributed = await insertContact(
      guestContact(residence.id, { status: EContactStatus.LOGEMENT_ATTRIBUE, createdAt: daysAgo(5), updatedAt: daysAgo(5) }),
    )
    const pending = await insertContact(
      guestContact(residence.id, { status: EContactStatus.A_CONTACTER, createdAt: daysAgo(2), updatedAt: daysAgo(2) }),
    )

    const byStatus = await listOwnerContacts(owner.id, filters({ statuses: [EContactStatus.CONTACTE, EContactStatus.LOGEMENT_ATTRIBUE] }))
    expect(byStatus.results.map((r) => r.id).sort()).toEqual([contacted.id, attributed.id].sort())
    expect(byStatus.count).toBe(2)

    const byCreated = await listOwnerContacts(owner.id, filters({ createdSince: daysAgo(6), createdUntil: daysAgo(3) }))
    expect(byCreated.results.map((r) => r.id)).toEqual([attributed.id])
    expect(byCreated.count).toBe(1)

    const byUpdated = await listOwnerContacts(owner.id, filters({ updatedSince: daysAgo(3) }))
    expect(byUpdated.results.map((r) => r.id).sort()).toEqual([contacted.id, pending.id].sort())
    expect(byUpdated.count).toBe(2)
  })

  it('pagination (pageSize 2, page 2) et order asc/desc, départage par id', async () => {
    const { owner, residence } = await seedOwner()
    const sameDate = daysAgo(3)
    const rows = await Promise.all([
      insertContact(guestContact(residence.id, { createdAt: daysAgo(4) })),
      insertContact(guestContact(residence.id, { createdAt: sameDate })),
      insertContact(guestContact(residence.id, { createdAt: sameDate })),
      insertContact(guestContact(residence.id, { createdAt: daysAgo(2) })),
      insertContact(guestContact(residence.id, { createdAt: daysAgo(1) })),
    ])
    const [oldest, tieA, tieB, newer, newest] = rows
    const [tieLow, tieHigh] = [tieA, tieB].sort((x, y) => (x.id < y.id ? -1 : 1))

    const ascPage2 = await listOwnerContacts(owner.id, filters({ order: 'asc', pageSize: 2, page: 2 }))
    expect(ascPage2.count).toBe(5)
    expect(ascPage2.results.map((r) => r.id)).toEqual([tieHigh.id, newer.id])

    const asc = await listOwnerContacts(owner.id, filters({ order: 'asc' }))
    expect(asc.results.map((r) => r.id)).toEqual([oldest.id, tieLow.id, tieHigh.id, newer.id, newest.id])

    const desc = await listOwnerContacts(owner.id, filters({ order: 'desc' }))
    expect(desc.results.map((r) => r.id)).toEqual([newest.id, newer.id, tieHigh.id, tieLow.id, oldest.id])

    const descPage3 = await listOwnerContacts(owner.id, filters({ order: 'desc', pageSize: 2, page: 3 }))
    expect(descPage3.results.map((r) => r.id)).toEqual([oldest.id])
  })
})

describe('getOwnerContact', () => {
  it("getOwnerContact : id d'un autre bailleur → null ; non confirmée → null ; purgée → version réduite", async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const foreign = await insertContact(guestContact(b.residence.id))
    const unconfirmed = await insertContact(guestContact(a.residence.id, { confirmedAt: null }))
    await createUser({ id: 'student-purged', email: 'purge@test.fr', name: 'Purgé' })
    const purged = await insertContact({
      accommodationId: a.residence.id,
      userId: 'student-purged',
      email: 'purge@test.fr',
      createdAt: daysAgo(45),
    })
    const visible = await insertContact(guestContact(a.residence.id))

    expect(await getOwnerContact(a.owner.id, foreign.id)).toBeNull()
    expect(await getOwnerContact(a.owner.id, unconfirmed.id)).toBeNull()
    expect(await getOwnerContact(a.owner.id, '00000000-0000-4000-8000-000000000000')).toBeNull()

    const reduced = await getOwnerContact(a.owner.id, purged.id)
    expect(reduced).toMatchObject({ id: purged.id, purged: true, purgedAt: null, student: null })
    expect(JSON.stringify(reduced)).not.toContain('purge@test.fr')

    const full = await getOwnerContact(a.owner.id, visible.id)
    expect(full).toMatchObject({ id: visible.id, purged: false, student: { firstname: 'Camille', lastname: 'Martin' } })
  })
})
