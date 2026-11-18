import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, not, or, type SQL, sql } from 'drizzle-orm'
import type { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import type { EStudyYear } from '~/enums/study-year'
import {
  CONTACT_BIRTHDATE_SQL,
  CONTACT_EMAIL_SQL,
  CONTACT_FIRSTNAME_SQL,
  CONTACT_LASTNAME_SQL,
  CONTACT_PHONE_SQL,
  CONTACT_SCHOLARSHIP_STATUS_SQL,
  CONTACT_STUDY_INSTITUTION_SQL,
  CONTACT_STUDY_YEAR_SQL,
  CONTACT_WORK_STUDY_SQL,
  parseStudyYear,
} from '~/server/candidatures/student-identity'
import { confirmedContactRequest, contactRetentionCutoff } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodations, contactRequests, owners, user } from '~/server/db/schema'

export type TContactsFilters = {
  createdSince?: Date
  createdUntil?: Date
  updatedSince?: Date
  residence?: string
  externalReference?: string
  statuses?: EContactStatus[]
  includePurged: boolean
  page: number
  pageSize: number
  order: 'asc' | 'desc'
}

export type TApiContactRow = {
  id: string
  residence: { slug: string; name: string; externalReference: string | null }
  status: EContactStatus
  apartmentType: string | null
  createdAt: Date
  updatedAt: Date
  contactedAt: Date | null
  purged: boolean
  purgedAt: Date | null
  student: {
    firstname: string | null
    lastname: string | null
    email: string | null
    phone: string | null
    birthdate: string | null
    scholarshipStatus: string | null
    isWorkStudy: boolean | null
    studyInstitution: string | null
    studyYear: EStudyYear | null
  } | null
}

const isPurged = (cutoff: Date): SQL => or(lt(contactRequests.createdAt, cutoff), isNotNull(contactRequests.anonymizedAt)) as SQL

const unlessPurged = <T>(purged: SQL, expression: SQL<T>) => sql<T | null>`case when ${purged} then null else ${expression} end`

const ownerScope = (ownerId: number): SQL | undefined => and(eq(accommodations.ownerId, ownerId), confirmedContactRequest())

const accommodationJoin = eq(contactRequests.accommodationId, accommodations.id)
const contactsModeOwnerJoin = and(eq(accommodations.ownerId, owners.id), eq(owners.contactMode, EOwnerContactMode.CONTACTS))

const selectRows = (cutoff: Date) => {
  const purged = isPurged(cutoff)
  return db
    .select({
      id: contactRequests.id,
      residenceSlug: accommodations.slug,
      residenceName: accommodations.name,
      residenceExternalReference: accommodations.externalReference,
      status: contactRequests.status,
      apartmentType: contactRequests.apartmentType,
      createdAt: contactRequests.createdAt,
      updatedAt: contactRequests.updatedAt,
      contactedAt: contactRequests.contactedAt,
      purged: sql<boolean>`${purged}`,
      purgedAt: contactRequests.anonymizedAt,
      firstname: unlessPurged(purged, CONTACT_FIRSTNAME_SQL),
      lastname: unlessPurged(purged, CONTACT_LASTNAME_SQL),
      email: unlessPurged(purged, CONTACT_EMAIL_SQL),
      phone: unlessPurged(purged, CONTACT_PHONE_SQL),
      birthdate: unlessPurged(purged, CONTACT_BIRTHDATE_SQL),
      scholarshipStatus: unlessPurged(purged, CONTACT_SCHOLARSHIP_STATUS_SQL),
      isWorkStudy: unlessPurged(purged, CONTACT_WORK_STUDY_SQL),
      studyInstitution: unlessPurged(purged, CONTACT_STUDY_INSTITUTION_SQL),
      studyYear: unlessPurged(purged, CONTACT_STUDY_YEAR_SQL),
    })
    .from(contactRequests)
    .innerJoin(accommodations, accommodationJoin)
    .innerJoin(owners, contactsModeOwnerJoin)
    .leftJoin(user, and(eq(user.id, contactRequests.userId), not(purged)))
}

type TContactRow = Awaited<ReturnType<ReturnType<typeof selectRows>['execute']>>[number]

const toApiContact = (row: TContactRow): TApiContactRow => ({
  id: row.id,
  residence: { slug: row.residenceSlug, name: row.residenceName, externalReference: row.residenceExternalReference },
  status: row.status,
  apartmentType: row.apartmentType,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  contactedAt: row.contactedAt,
  purged: row.purged,
  purgedAt: row.purgedAt,
  student: row.purged
    ? null
    : {
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        phone: row.phone,
        birthdate: row.birthdate,
        scholarshipStatus: row.scholarshipStatus,
        isWorkStudy: row.isWorkStudy,
        studyInstitution: row.studyInstitution,
        studyYear: parseStudyYear(row.studyYear),
      },
})

export async function listOwnerContacts(ownerId: number, filters: TContactsFilters): Promise<{ count: number; results: TApiContactRow[] }> {
  const cutoff = contactRetentionCutoff()
  const where = and(
    ownerScope(ownerId),
    filters.includePurged ? undefined : gte(contactRequests.createdAt, cutoff),
    filters.createdSince ? gte(contactRequests.createdAt, filters.createdSince) : undefined,
    filters.createdUntil ? lt(contactRequests.createdAt, filters.createdUntil) : undefined,
    filters.updatedSince ? gte(contactRequests.updatedAt, filters.updatedSince) : undefined,
    filters.residence !== undefined ? eq(accommodations.slug, filters.residence) : undefined,
    filters.externalReference !== undefined ? eq(accommodations.externalReference, filters.externalReference) : undefined,
    filters.statuses?.length ? inArray(contactRequests.status, filters.statuses) : undefined,
  )
  const direction = filters.order === 'asc' ? asc : desc

  const [rows, [total]] = await Promise.all([
    selectRows(cutoff)
      .where(where)
      .orderBy(direction(contactRequests.createdAt), direction(contactRequests.id))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ n: count() })
      .from(contactRequests)
      .innerJoin(accommodations, accommodationJoin)
      .innerJoin(owners, contactsModeOwnerJoin)
      .where(where),
  ])

  return { count: total?.n ?? 0, results: rows.map(toApiContact) }
}

/** Le détail ne dépend pas de la fenêtre de rétention : une demande ancienne sort en version purgée. */
export async function getOwnerContact(ownerId: number, id: string): Promise<TApiContactRow | null> {
  const [row] = await selectRows(contactRetentionCutoff())
    .where(and(ownerScope(ownerId), eq(contactRequests.id, id)))
    .limit(1)
  return row ? toApiContact(row) : null
}
