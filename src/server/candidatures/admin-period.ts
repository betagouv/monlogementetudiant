import { type AnyColumn, type SQL, sql } from 'drizzle-orm'
import type { TAdminCandidaturesPeriod } from '~/schemas/candidatures/admin-period'
import { user } from '~/server/db/schema/auth'
import { contactRequests } from '~/server/db/schema/contacts'

export const createdInPeriod = (column: AnyColumn, period: TAdminCandidaturesPeriod): SQL =>
  sql`${column} >= ${period.from}::date and ${column} < ${period.to}::date + 1`

/**
 * La purge vide le statut boursier de la demande au bout de la rétention : on retombe alors sur le
 * profil de l'étudiant connecté, qui reflète son statut actuel. Suppose `user` joint à la requête.
 */
export const contactScholarshipStatus = sql<
  'yes' | 'no' | 'unknown' | null
>`coalesce(${contactRequests.scholarshipStatus}, ${user.scholarshipStatus})`
