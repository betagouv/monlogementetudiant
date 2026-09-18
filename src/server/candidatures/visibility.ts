import { and, eq, gte, isNotNull, or, type SQL } from 'drizzle-orm'
import { CONTACT_RETENTION_DAYS } from '~/enums/contact-status'
import { DF_RETENTION_DAYS, DF_TENANT_STATUS_VERIFIED } from '~/enums/dossier-facile-tenant-status'
import { db } from '~/server/db'
import { contactRequests, dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema'
import { DAY_MS } from '~/utils/time'

/** Début de la fenêtre de rétention : les demandes de contact antérieures ne sont plus restituées. */
export const contactRetentionCutoff = () => new Date(Date.now() - CONTACT_RETENTION_DAYS * DAY_MS)

/**
 * Idem pour DossierFacile. Fenêtre distincte de celle des contacts, même si les deux durées
 * coïncident aujourd'hui — cf. `DF_RETENTION_DAYS`.
 */
export const dossierFacileRetentionCutoff = () => new Date(Date.now() - DF_RETENTION_DAYS * DAY_MS)

/**
 * Ce que « visible du gestionnaire » veut dire, pour les deux canaux de candidature.
 *
 * Les prédicats ci-dessous servent aux **listes** ; pour atteindre une ligne précise, passer par
 * `findVisibleContactRequest` / `findVisibleApplication`, qui appliquent la même règle sans qu'on
 * puisse l'oublier. Toute lecture ou écriture portant sur une candidature doit franchir l'un des deux.
 */

/**
 * Demande de contact visible :
 * - **confirmée** — une demande visiteur n'existe pour le gestionnaire qu'une fois l'adresse prouvée
 *   par double opt-in ; les demandes liées à un compte sont confirmées d'office ;
 * - **récente** — au-delà de `CONTACT_RETENTION_DAYS` elle disparaît, conformément à ce que
 *   l'interface annonce au gestionnaire. Le cron de purge vide les coordonnées peu après.
 */
export const visibleContactRequest = (): SQL | undefined =>
  and(
    or(isNotNull(contactRequests.userId), isNotNull(contactRequests.confirmedAt)),
    gte(contactRequests.createdAt, contactRetentionCutoff()),
  )

/**
 * Candidature DossierFacile visible : même fenêtre de rétention, **et** dossier validé.
 *
 * Les deux moitiés sont volontairement inséparables, pour qu'aucun lecteur n'ait à penser à
 * combiner le statut du locataire. Suppose que `dossier_facile_tenant` est joint à la requête.
 */
export const visibleDossierFacileApplication = (): SQL | undefined =>
  and(gte(dossierFacileApplications.createdAt, dossierFacileRetentionCutoff()), eq(dossierFacileTenants.status, DF_TENANT_STATUS_VERIFIED))

/** La demande de contact désignée, si elle est visible du gestionnaire — `null` sinon. */
export const findVisibleContactRequest = async (id: string) => {
  const request = await db.query.contactRequests.findFirst({
    where: and(eq(contactRequests.id, id), visibleContactRequest()),
    with: { user: true, accommodation: true },
  })
  return request ?? null
}

/**
 * La candidature DossierFacile désignée, si elle est visible du gestionnaire — `null` sinon.
 *
 * La requête relationnelle ne peut pas porter le prédicat sur la table jointe : le statut du
 * locataire est donc revérifié ici, sur la ligne chargée.
 */
export const findVisibleApplication = async (id: string) => {
  const application = await db.query.dossierFacileApplications.findFirst({
    where: and(eq(dossierFacileApplications.id, id), gte(dossierFacileApplications.createdAt, dossierFacileRetentionCutoff())),
    with: { tenant: { with: { documents: true } } },
  })
  if (!application || application.tenant.status !== DF_TENANT_STATUS_VERIFIED) return null
  return application
}

/**
 * Une candidature encore visible pour ce locataire, s'il en reste une.
 *
 * C'est ce qui autorise l'accès au dossier : plus aucune candidature dans la fenêtre, plus de motif
 * pour un gestionnaire de consulter les pièces.
 */
export const findVisibleApplicationForTenant = async (tenantId: string, readerFilter?: SQL) => {
  const application = await db.query.dossierFacileApplications.findFirst({
    where: and(
      eq(dossierFacileApplications.tenantId, tenantId),
      gte(dossierFacileApplications.createdAt, dossierFacileRetentionCutoff()),
      // Restriction propre au lecteur, que ce module ne connaît pas. Elle doit être dans le `where` :
      // ce `findFirst` n'est pas ordonné, et un locataire ayant candidaté sur deux résidences du même
      // bailleur ferait sinon passer ou échouer la garde de l'appelant selon la ligne tirée.
      readerFilter,
    ),
    columns: { accommodationSlug: true },
    with: { tenant: { columns: { status: true } } },
  })
  if (!application || application.tenant.status !== DF_TENANT_STATUS_VERIFIED) return null
  return application
}
