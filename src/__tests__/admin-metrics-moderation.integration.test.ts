import { describe, expect, it } from 'vitest'
import { EReminderType } from '~/enums/reminder-email'
import { getOwnerModeration } from '~/server/admin-metrics/moderation'
import { activityLog, applicationFacts, reminderEmailItems, reminderEmails } from '~/server/db/schema'
import { createAcademy, createAccommodation, createCity, createDepartment, createOwner } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

type TFact = typeof applicationFacts.$inferInsert

const fact = (id: string, overrides: Partial<TFact>): TFact => ({
  id,
  channel: 'contact',
  createdAt: new Date('2026-10-05T10:00:00Z'),
  status: 'a_contacter',
  ...overrides,
})

describe('getOwnerModeration', () => {
  it('segmente les gestionnaires et calcule les indicateurs du mois', async () => {
    const db = getTestDb()
    const academy = await createAcademy({ name: 'Académie Modération' })
    const department = await createDepartment({ academyId: academy.id, name: 'Département Modération', code: '43' })
    const city = await createCity({ departmentId: department.id, name: 'Ville Modération', slug: 'ville-moderation' })
    const a = await createOwner({ slug: 'bailleur-a', name: 'A' })
    const b = await createOwner({ slug: 'bailleur-b', name: 'B' })
    const c = await createOwner({ slug: 'bailleur-c', name: 'C' })
    const d = await createOwner({ slug: 'bailleur-d', name: 'D' })
    await createOwner({ slug: 'bailleur-e', name: 'E' })
    const f = await createOwner({ slug: 'bailleur-f', name: 'F' })
    const residenceB = await createAccommodation({ slug: 'residence-b', ownerId: b.id, cityId: city.id })
    await createAccommodation({ slug: 'residence-d', ownerId: d.id, cityId: city.id, published: true })

    await db.insert(applicationFacts).values([
      fact('contact:a1', {
        ownerId: a.id,
        scholarshipStatus: 'yes',
        firstTreatedAt: new Date('2026-10-07T10:00:00Z'),
        contactedAt: new Date('2026-10-07T10:00:00Z'),
      }),
      fact('contact:a2', { ownerId: a.id, firstTreatedAt: new Date('2026-10-07T10:00:00Z') }),
      fact('contact:b1', { ownerId: b.id, firstTreatedAt: new Date('2026-10-06T10:00:00Z') }),
      fact('contact:c1', { ownerId: c.id }),
      fact('contact:c2', { ownerId: c.id }),
      fact('contact:old', { ownerId: d.id, createdAt: new Date('2026-09-01T10:00:00Z'), firstTreatedAt: new Date('2026-09-05T10:00:00Z') }),
      fact('contact:oldf', {
        ownerId: f.id,
        createdAt: new Date('2026-08-01T10:00:00Z'),
        firstTreatedAt: new Date('2026-08-03T10:00:00Z'),
      }),
      fact('contact:none', { ownerId: null }),
    ])

    const [warning] = await db
      .insert(reminderEmails)
      .values({
        messageId: 'm1',
        type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
        ownerId: b.id,
        recipientEmail: 'b@example.com',
        sentAt: new Date('2026-10-20T10:00:00Z'),
      })
      .returning()
    const [stale] = await db
      .insert(reminderEmails)
      .values({
        messageId: 'm2',
        type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
        ownerId: a.id,
        recipientEmail: 'a@example.com',
        sentAt: new Date('2026-10-20T10:00:00Z'),
      })
      .returning()
    await db.insert(reminderEmailItems).values([
      { reminderEmailId: warning.id, accommodationId: residenceB.id, reason: 'unprocessed_applications' },
      { reminderEmailId: warning.id, accommodationId: residenceB.id, reason: 'unprocessed_applications' },
      { reminderEmailId: stale.id, accommodationId: residenceB.id, reason: 'stale_availability' },
    ])
    await db.insert(activityLog).values({
      action: 'accommodation.applications_auto_suspended',
      entityType: 'accommodation',
      ownerId: d.id,
      createdAt: new Date('2026-11-02T10:00:00Z'),
      metadata: { reason: 'unprocessed_applications' },
    })

    const rows = await getOwnerModeration('2026-10')
    const byName = Object.fromEntries(rows.map((row) => [row.ownerName, row]))

    expect(rows.map((row) => row.ownerName)).toEqual(['C', 'B', 'A', 'D'])
    expect(byName.A).toMatchObject({
      segment: 'bon_eleve',
      recus: 2,
      recusBoursiers: 1,
      aTraiter: 2,
      traites: 2,
      jamaisTraites: 0,
      contactes: 1,
      delaiMoyenHeures: 48,
      alertes: 0,
    })
    expect(byName.B).toMatchObject({ segment: 'irregulier', alertes: 1, delaiMoyenHeures: 24 })
    expect(byName.C).toMatchObject({
      segment: 'mauvais_eleve',
      recus: 2,
      aTraiter: 2,
      traites: 0,
      jamaisTraites: 2,
      delaiMoyenHeures: null,
    })
    expect(byName.D).toMatchObject({ segment: 'non_concerne', recus: 0, aTraiter: 0, suspensions: 0 })
  })

  it('compte les suspensions du mois', async () => {
    const db = getTestDb()
    const owner = await createOwner({ slug: 'bailleur-s', name: 'S' })
    await db.insert(activityLog).values([
      {
        action: 'accommodation.applications_auto_suspended',
        entityType: 'accommodation',
        ownerId: owner.id,
        createdAt: new Date('2026-10-10T10:00:00Z'),
        metadata: { reason: 'unprocessed_applications' },
      },
      {
        action: 'accommodation.applications_auto_suspended',
        entityType: 'accommodation',
        ownerId: owner.id,
        createdAt: new Date('2026-10-11T10:00:00Z'),
        metadata: { reason: 'stale_availability' },
      },
    ])
    const rows = await getOwnerModeration('2026-10')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ ownerName: 'S', segment: 'mauvais_eleve', suspensions: 1 })
  })
})
