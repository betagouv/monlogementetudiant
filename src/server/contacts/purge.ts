import { and, count, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm'
import { UNCONFIRMED_CONTACT_RETENTION_DAYS } from '~/enums/contact-status'
import { contactRetentionCutoff, dossierFacileRetentionCutoff } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { contactRequests, dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema'
import { DAY_MS } from '~/utils/time'

export interface PurgeContactRequestsResult {
  /** Demandes visiteur jamais confirmées, supprimées. */
  deleted: number
  /** Demandes de contact dont les coordonnées ont été vidées. */
  anonymized: number
  /** Locataires DossierFacile supprimés (documents et candidatures emportés par cascade). */
  dossiersPurged: number
}

/**
 * Locataires DossierFacile sortis de la fenêtre de rétention.
 *
 * Deux populations, et il faut les deux :
 * 1. **ceux qui ont candidaté** — leur candidature la plus récente est hors fenêtre, plus aucun
 *    gestionnaire n'a de motif d'accéder à leur dossier ;
 * 2. **ceux qui ont seulement lié leur compte** — jamais aucune candidature, donc jamais rien
 *    exposé à personne, mais la ligne porte quand même le nom et le statut renvoyés par
 *    DossierFacile. Rien ne justifie de les garder au-delà de la même durée.
 *
 * La seconde population était exclue par construction tant que la requête partait des candidatures.
 */
const findTenantsOutOfRetention = async (): Promise<string[]> => {
  const cutoff = dossierFacileRetentionCutoff().toISOString()

  const [applied, neverApplied] = await Promise.all([
    db
      .select({ tenantId: dossierFacileApplications.tenantId })
      .from(dossierFacileApplications)
      .groupBy(dossierFacileApplications.tenantId)
      // `toISOString` explicite : en SQL brut, Drizzle n'a pas le mapper de colonne pour sérialiser un Date.
      .having(sql`max(${dossierFacileApplications.createdAt}) < ${cutoff}::timestamptz`),
    db
      .select({ tenantId: dossierFacileTenants.id })
      .from(dossierFacileTenants)
      .where(
        and(
          lt(dossierFacileTenants.createdAt, dossierFacileRetentionCutoff()),
          notInArray(dossierFacileTenants.id, db.select({ id: dossierFacileApplications.tenantId }).from(dossierFacileApplications)),
        ),
      ),
  ])

  return [...applied.map((r) => r.tenantId), ...neverApplied.map((r) => r.tenantId)]
}

/**
 * Purge RGPD des candidatures, tous canaux confondus.
 *
 * **Demandes de contact** — deux passes :
 * 1. suppression des demandes visiteur jamais confirmées par double opt-in au-delà de 7 jours :
 *    elles n'ont jamais été transmises à personne, il n'y a rien à en conserver ;
 * 2. anonymisation des demandes de plus de 30 jours — la ligne survit, seules les données
 *    personnelles partent (coordonnées, date de naissance, statut boursier). Ce qui reste
 *    (résidence, date, statut, type de logement, et `user_id` quand la demande est liée à un
 *    compte) suffit à l'historique et aux compteurs.
 *
 * **DossierFacile** — la ligne `dossier_facile_tenant` est supprimée, et sa cascade emporte les
 * documents mis en cache comme les candidatures. Couper les seuls liens ne suffisait pas : la ligne
 * conservait indéfiniment le nom, l'identifiant et le statut renvoyés par DossierFacile, hors de
 * toute durée de conservation. C'est le même effacement que sur le callback `DELETED_ACCOUNT` et
 * que sur la déconnexion depuis l'espace étudiant. L'étudiant qui recandidate reconnecte son
 * dossier, et une nouvelle ligne est créée.
 *
 * Idempotent : `anonymized_at` et les colonnes déjà à `null` empêchent de repasser sur les demandes
 * de contact déjà traitées ; côté DossierFacile, les lignes supprimées ne sont plus sélectionnées
 * au passage suivant.
 */
export const purgeContactRequests = async ({ dryRun = false } = {}): Promise<PurgeContactRequestsResult> => {
  const unconfirmedCutoff = new Date(Date.now() - UNCONFIRMED_CONTACT_RETENTION_DAYS * DAY_MS)

  const staleUnconfirmed = and(
    isNull(contactRequests.userId),
    isNull(contactRequests.confirmedAt),
    lt(contactRequests.createdAt, unconfirmedCutoff),
  )
  const outOfRetention = () => and(lt(contactRequests.createdAt, contactRetentionCutoff()), isNull(contactRequests.anonymizedAt))

  const staleTenantIds = await findTenantsOutOfRetention()

  if (dryRun) {
    const [[unconfirmed], [expired]] = await Promise.all([
      db.select({ n: count() }).from(contactRequests).where(staleUnconfirmed),
      db.select({ n: count() }).from(contactRequests).where(outOfRetention()),
    ])
    return { deleted: unconfirmed?.n ?? 0, anonymized: expired?.n ?? 0, dossiersPurged: staleTenantIds.length }
  }

  const deleted = await db.delete(contactRequests).where(staleUnconfirmed).returning({ id: contactRequests.id })

  const anonymized = await db
    .update(contactRequests)
    .set({
      firstname: null,
      lastname: null,
      email: null,
      phone: null,
      birthdate: null,
      scholarshipStatus: null,
      ipHash: null,
      anonymizedAt: new Date(),
      updatedAt: new Date(),
    })
    // Réévalué après la suppression : les lignes effacées ci-dessus ne doivent pas être recomptées.
    .where(outOfRetention())
    .returning({ id: contactRequests.id })

  // La cascade de `dossier_facile_tenant` emporte documents et candidatures.
  const purgedTenants =
    staleTenantIds.length > 0
      ? await db
          .delete(dossierFacileTenants)
          .where(inArray(dossierFacileTenants.id, staleTenantIds))
          .returning({ id: dossierFacileTenants.id })
      : []

  return { deleted: deleted.length, anonymized: anonymized.length, dossiersPurged: purgedTenants.length }
}
