import { sql } from 'drizzle-orm'
import { contactRequests, dossierFacileTenants, user } from '~/server/db/schema'

/**
 * Le nom affiché d'un candidat, règle unique pour les deux canaux.
 *
 * Les coordonnées portées par `contact_request` sont une copie dénormalisée de celles du compte :
 * elles priment tant qu'elles existent, et le compte prend le relais une fois la ligne anonymisée
 * par la purge. Côté DossierFacile, c'est le dernier payload persisté qui prime sur le compte.
 *
 * Cette règle était auparavant écrite quatre fois — deux en SQL, deux en TypeScript, avec trois
 * politiques de repli différentes.
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
