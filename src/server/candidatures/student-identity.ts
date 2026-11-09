import { sql } from 'drizzle-orm'
import { type EStudyYear, ZStudyYear } from '~/enums/study-year'
import { contactRequests, dossierFacileTenants, user } from '~/server/db/schema'

/**
 * Le nom affiché d'un candidat, règle unique pour les deux canaux.
 *
 * Les coordonnées portées par `contact_request` sont une copie dénormalisée de celles du compte :
 * elles priment tant qu'elles existent, et le compte prend le relais une fois la ligne anonymisée
 * par la purge. Côté DossierFacile, c'est le dernier payload persisté qui prime sur le compte.
 */

/** Version SQL, pour les projections de liste (mode `contacts`). */
export const CONTACT_STUDENT_NAME_SQL = sql<string | null>`coalesce(
  nullif(concat_ws(' ', ${contactRequests.firstname}, ${contactRequests.lastname}), ''),
  ${user.name}
)`

/**
 * Statut boursier d'une demande de contact, même règle de repli que le nom : la valeur saisie dans
 * le formulaire prime — c'est la seule dont dispose un visiteur sans compte — et le profil du compte
 * prend le relais une fois la ligne anonymisée.
 */
export const CONTACT_SCHOLARSHIP_STATUS_SQL = sql<string | null>`coalesce(${contactRequests.scholarshipStatus}, ${user.scholarshipStatus})`

export const CONTACT_BIRTHDATE_SQL = sql<string | null>`coalesce(${contactRequests.birthdate}, ${user.birthdate})`

export const CONTACT_WORK_STUDY_SQL = sql<boolean | null>`coalesce(${contactRequests.isWorkStudy}, ${user.isWorkStudy})`

export const CONTACT_STUDY_INSTITUTION_SQL = sql<string | null>`coalesce(${contactRequests.studyInstitution}, ${user.studyInstitution})`

export const CONTACT_STUDY_YEAR_SQL = sql<string | null>`coalesce(${contactRequests.studyYear}, ${user.studyYear})`

export const parseStudyYear = (value: unknown): EStudyYear | null => {
  const result = ZStudyYear.safeParse(value)
  return result.success ? result.data : null
}

/** Version SQL, pour les projections de liste (mode `dossier_facile`). */
export const DOSSIER_FACILE_STUDENT_NAME_SQL = sql<string | null>`coalesce(${dossierFacileTenants.name}, ${user.name})`

/** Version TypeScript, pour les fiches détail — même règle que `CONTACT_STUDENT_NAME_SQL`. */
export const contactStudentName = (request: {
  firstname: string | null
  lastname: string | null
  user?: { name: string | null } | null
}): string | null => [request.firstname, request.lastname].filter(Boolean).join(' ') || request.user?.name || null

/** Version TypeScript, pour les fiches détail — même règle que `DOSSIER_FACILE_STUDENT_NAME_SQL`. */
export const dossierFacileStudentName = (
  tenant: { name: string | null },
  account: { name: string | null } | null | undefined,
): string | null => tenant.name ?? account?.name ?? null
