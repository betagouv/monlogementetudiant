import { and, eq, inArray, isNotNull, or, type SQL, sql } from 'drizzle-orm'
import { EXPANDED_SEARCH_PAGE_SIZE } from '~/lib/accommodations-expanded-search'
import { db } from '~/server/db'
import {
  accommodations,
  alertAvailabilitySnapshots,
  alertJobs,
  favoriteAccommodations,
  owners,
  studentAlerts,
  user,
} from '~/server/db/schema'
import { type AlertMatchInput, accommodationAvailableCount, buildAlertMatchConditions, buildSimilarMatchConditions } from './alert-matching'

export type AlertDetectorResult = {
  /** Nombre de résidences dont la dispo a augmenté ce run. */
  triggered: number
  /** Nombre de jobs d'alerte créés (couples étudiant × résidence). */
  jobsCreated: number
  /** Nombre de résidences enregistrées pour la première fois dans le snapshot. */
  seeded: number
}

// Dispo totale courante d'une résidence (NULL = non-renseignée). Définition mutualisée.
const currentAvailableCount = accommodationAvailableCount

// Périmètre du détecteur : résidences publiées et hors CROUS (même exclusion que le matching).
const inScopeCondition = and(
  eq(accommodations.published, true),
  sql`(${accommodations.ownerId} IS NULL OR ${accommodations.ownerId} NOT IN (SELECT ${owners.id} FROM ${owners} WHERE ${owners.slug} = 'crous'))`,
)

function toFavoriteJobRow(f: { userId: string; accommodationId: number }) {
  return { userId: f.userId, studentAlertId: null, accommodationId: f.accommodationId, source: 'favorite' as const }
}

type AlertForMatching = AlertMatchInput & { id: number; userId: string; similarEnabled: boolean }

/**
 * Résidences de la zone élargie d'une alerte ville (préférence « logements similaires » activée),
 * plafonnées à EXPANDED_SEARCH_PAGE_SIZE par run — même limite que la section « Plus de
 * résultats » du moteur de recherche, pour ne pas noyer l'e-mail de suggestions.
 */
async function matchSimilarJobRows(alert: AlertForMatching, scope: SQL | undefined) {
  if (!alert.similarEnabled) return []
  const conditions = buildSimilarMatchConditions(alert)
  if (!conditions) return []

  const matched = await db
    .select({ id: accommodations.id })
    .from(accommodations)
    .where(and(scope, ...conditions))
    .limit(EXPANDED_SEARCH_PAGE_SIZE)

  return matched.map((m) => ({ userId: alert.userId, studentAlertId: alert.id, accommodationId: m.id, source: 'similar' as const }))
}

async function insertAlertJobsInBatches(rows: (typeof alertJobs.$inferInsert)[], conn: Pick<typeof db, 'insert'> = db): Promise<number> {
  const BATCH_SIZE = 1000
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const inserted = await conn
      .insert(alertJobs)
      .values(rows.slice(i, i + BATCH_SIZE))
      .onConflictDoNothing()
      .returning({ id: alertJobs.id })
    total += inserted.length
  }
  return total
}

/**
 * Détecte les hausses de disponibilité et crée les jobs d'alerte (status `pending`)
 * pour les étudiants concernés. Produit uniquement des jobs ; l'envoi est assuré par
 * `sendPendingAlertJobs`.
 *
 * Une hausse déclenche si `dispo_courante > 0` ET `dispo_courante > dispo_précédente`
 * (le « non-renseigné » et l'absence de snapshot comptant comme une base inférieure à 0).
 * Le tout premier run (snapshot vide) ne fait qu'enregistrer la baseline, sans notifier.
 *
 * `accommodationIds` restreint le scan à ces résidences (mode événementiel : on ne traite
 * que celles qui viennent d'être écrites). Sans ce filtre, scan complet (cron de
 * réconciliation). Seules les résidences scannées voient leur snapshot mis à jour.
 */
export async function detectAlertJobs(
  options: { dryRun?: boolean; verbose?: boolean; accommodationIds?: number[] } = {},
): Promise<AlertDetectorResult> {
  if (options.accommodationIds && options.accommodationIds.length === 0) {
    return { triggered: 0, jobsCreated: 0, seeded: 0 }
  }

  const [{ value: snapshotCount }] = await db.select({ value: sql<number>`count(*)::int` }).from(alertAvailabilitySnapshots)
  const isFirstRun = snapshotCount === 0

  const scopeCondition = options.accommodationIds
    ? and(inScopeCondition, inArray(accommodations.id, options.accommodationIds))
    : inScopeCondition

  // Dispo courante de chaque résidence en périmètre + dispo précédente (snapshot).
  const rows = await db
    .select({
      accommodationId: accommodations.id,
      current: currentAvailableCount,
      prev: alertAvailabilitySnapshots.availableCount,
      hasSnapshot: sql<boolean>`${alertAvailabilitySnapshots.accommodationId} IS NOT NULL`,
    })
    .from(accommodations)
    .leftJoin(alertAvailabilitySnapshots, eq(alertAvailabilitySnapshots.accommodationId, accommodations.id))
    .where(scopeCondition)

  if (rows.length === 0) return { triggered: 0, jobsCreated: 0, seeded: 0 }

  // Résidences dont la dispo a augmenté.
  const triggeredIds: number[] = []
  for (const r of rows) {
    if (isFirstRun) continue // baseline silencieuse
    if (r.current == null || r.current <= 0) continue
    const increased = !r.hasSnapshot || r.prev == null || r.current > r.prev
    if (increased) triggeredIds.push(r.accommodationId)
  }

  const seeded = isFirstRun ? rows.length : rows.filter((r) => !r.hasSnapshot).length

  // Croisement avec les alertes actives (opt-in via receiveNotifications).
  const alertJobRows: { userId: string; studentAlertId: number; accommodationId: number; source: 'alert' | 'similar' }[] = []
  if (triggeredIds.length > 0) {
    const activeAlerts = await db
      .select({
        id: studentAlerts.id,
        userId: studentAlerts.userId,
        cityId: studentAlerts.cityId,
        departmentId: studentAlerts.departmentId,
        academyId: studentAlerts.academyId,
        hasColiving: studentAlerts.hasColiving,
        isAccessible: studentAlerts.isAccessible,
        maxPrice: studentAlerts.maxPrice,
        similarEnabled: user.similarAccommodationAlertsEnabled,
      })
      .from(studentAlerts)
      .innerJoin(user, eq(studentAlerts.userId, user.id))
      // Alertes actives ET dotées d'un territoire : une alerte sans territoire matcherait
      // tout le pays (buildTerritoryCondition renvoie null) → exclue pour éviter le spam.
      .where(
        and(
          eq(studentAlerts.receiveNotifications, true),
          or(isNotNull(studentAlerts.cityId), isNotNull(studentAlerts.departmentId), isNotNull(studentAlerts.academyId)),
        ),
      )

    for (const alert of activeAlerts) {
      const matched = await db
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(and(inArray(accommodations.id, triggeredIds), ...buildAlertMatchConditions(alert)))

      for (const m of matched) {
        alertJobRows.push({ userId: alert.userId, studentAlertId: alert.id, accommodationId: m.id, source: 'alert' })
      }

      alertJobRows.push(...(await matchSimilarJobRows(alert, inArray(accommodations.id, triggeredIds))))
    }
  }

  // Croisement avec les favoris : étudiants ayant épinglé une résidence dont la dispo a augmenté.
  const favJobRows =
    triggeredIds.length > 0
      ? (
          await db
            .select({ userId: favoriteAccommodations.userId, accommodationId: favoriteAccommodations.accommodationId })
            .from(favoriteAccommodations)
            .where(inArray(favoriteAccommodations.accommodationId, triggeredIds))
        ).map(toFavoriteJobRow)
      : []

  const allJobRows = [...alertJobRows, ...favJobRows]

  if (options.verbose) {
    console.log(
      `  ${isFirstRun ? '[baseline] ' : ''}résidences en périmètre : ${rows.length}, hausses : ${triggeredIds.length}, jobs candidats : ${allJobRows.length} (alertes: ${alertJobRows.length}, favoris: ${favJobRows.length})`,
    )
  }

  let jobsCreated = allJobRows.length
  if (!options.dryRun) {
    jobsCreated = await db.transaction(async (tx) => {
      // Création des jobs : onConflictDoNothing s'appuie sur les deux index uniques partiels.
      let created = 0
      if (allJobRows.length > 0) {
        created = await insertAlertJobsInBatches(allJobRows, tx)
      }

      // Mise à jour de la mémoire : dispo courante de toutes les résidences en périmètre.
      const snapshotValues = rows.map((r) => ({ accommodationId: r.accommodationId, availableCount: r.current, updatedAt: new Date() }))
      await tx
        .insert(alertAvailabilitySnapshots)
        .values(snapshotValues)
        .onConflictDoUpdate({
          target: alertAvailabilitySnapshots.accommodationId,
          set: { availableCount: sql`excluded.available_count`, updatedAt: new Date() },
        })

      return created
    })
  }

  return { triggered: triggeredIds.length, jobsCreated, seeded }
}

/**
 * Amorce (ou ré-amorce) le snapshot pour tout le stock publié hors CROUS, **sans créer
 * aucun job**.
 * une fois le snapshot peuplé, « pas de ligne de snapshot » signifie « résidence
 * réellement nouvelle » (et non « stock préexistant »). Sans ce baseline, une simple édition
 * d'une résidence déjà disponible (sans rapport avec la dispo) serait vue comme une
 * apparition et déclencherait une notification fictive.
 */
export async function seedAvailabilitySnapshot(options: { dryRun?: boolean } = {}): Promise<{ seeded: number }> {
  const rows = await db
    .select({ accommodationId: accommodations.id, current: currentAvailableCount })
    .from(accommodations)
    .where(inScopeCondition)

  if (options.dryRun || rows.length === 0) return { seeded: rows.length }

  const values = rows.map((r) => ({ accommodationId: r.accommodationId, availableCount: r.current, updatedAt: new Date() }))
  await db
    .insert(alertAvailabilitySnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: alertAvailabilitySnapshots.accommodationId,
      set: { availableCount: sql`excluded.available_count`, updatedAt: new Date() },
    })

  return { seeded: rows.length }
}

/**
 * Amorçage à la création d'une alerte (flux « pull »).
 *
 * Le détecteur ci-dessus ne réagit qu'aux *hausses* de dispo : une résidence déjà
 * disponible et stable ne produira jamais d'événement. Un étudiant qui crée son alerte
 * ne serait donc jamais notifié du **stock déjà disponible** qui la satisfait. Cette
 * fonction comble ce trou : à la création, on scanne les résidences **actuellement
 * disponibles** (`dispo > 0`) qui matchent l'alerte et on enfile les jobs correspondants.
 *
 * Ne touche **pas** le snapshot : celui-ci sert au suivi des deltas du détecteur ; le
 * modifier ici fausserait la détection des hausses ultérieures. La déduplication est
 * assurée par l'index unique partiel de `alert_job`.
 */
export async function enqueueJobsForNewAlert(alertId: number): Promise<number> {
  const [alert] = await db
    .select({
      id: studentAlerts.id,
      userId: studentAlerts.userId,
      cityId: studentAlerts.cityId,
      departmentId: studentAlerts.departmentId,
      academyId: studentAlerts.academyId,
      hasColiving: studentAlerts.hasColiving,
      isAccessible: studentAlerts.isAccessible,
      maxPrice: studentAlerts.maxPrice,
      receiveNotifications: studentAlerts.receiveNotifications,
      similarEnabled: user.similarAccommodationAlertsEnabled,
    })
    .from(studentAlerts)
    .innerJoin(user, eq(studentAlerts.userId, user.id))
    .where(eq(studentAlerts.id, alertId))

  // Alerte introuvable, opt-out, ou sans territoire (matcherait tout le pays) → on n'enfile rien.
  if (!alert || !alert.receiveNotifications) return 0
  if (alert.cityId == null && alert.departmentId == null && alert.academyId == null) return 0

  const available = sql`${currentAvailableCount} > 0`
  const matched = await db
    .select({ id: accommodations.id })
    .from(accommodations)
    .where(and(available, ...buildAlertMatchConditions(alert)))

  const jobRows = [
    ...matched.map((m) => ({ userId: alert.userId, studentAlertId: alert.id, accommodationId: m.id, source: 'alert' as const })),
    ...(await matchSimilarJobRows(alert, available)),
  ]
  if (jobRows.length === 0) return 0

  return insertAlertJobsInBatches(jobRows)
}

/**
 * Backfill ponctuel (flux « pull » de masse) : pour **toutes** les alertes actives ET pour
 * **tous les favoris**, enfile les jobs correspondant au **stock actuellement disponible**
 * (`dispo > 0`).
 *
 * Sert à amorcer une première vague de notifications au démarrage du système : sans lui,
 * les alertes et favoris existants ne seraient jamais avertis du stock déjà présent. À jouer
 * **une seule fois**, explicitement (opt-in).
 *
 * Ne touche **pas** le snapshot (même raison qu'`enqueueJobsForNewAlert`). Idempotent :
 * les index uniques partiels de `alert_job` empêchent les doublons sur un re-run.
 */
export async function backfillAlertJobs(
  options: { dryRun?: boolean; verbose?: boolean } = {},
): Promise<{ alertsProcessed: number; jobsCreated: number }> {
  const activeAlerts = await db
    .select({
      id: studentAlerts.id,
      userId: studentAlerts.userId,
      cityId: studentAlerts.cityId,
      departmentId: studentAlerts.departmentId,
      academyId: studentAlerts.academyId,
      hasColiving: studentAlerts.hasColiving,
      isAccessible: studentAlerts.isAccessible,
      maxPrice: studentAlerts.maxPrice,
      similarEnabled: user.similarAccommodationAlertsEnabled,
    })
    .from(studentAlerts)
    .innerJoin(user, eq(studentAlerts.userId, user.id))
    // Mêmes garde-fous que le détecteur : opt-in + territoire défini (sinon match national).
    .where(
      and(
        eq(studentAlerts.receiveNotifications, true),
        or(isNotNull(studentAlerts.cityId), isNotNull(studentAlerts.departmentId), isNotNull(studentAlerts.academyId)),
      ),
    )

  const alertJobRows: { userId: string; studentAlertId: number; accommodationId: number; source: 'alert' | 'similar' }[] = []
  for (const alert of activeAlerts) {
    const available = sql`${currentAvailableCount} > 0`
    const matched = await db
      .select({ id: accommodations.id })
      .from(accommodations)
      .where(and(available, ...buildAlertMatchConditions(alert)))

    for (const m of matched) {
      alertJobRows.push({ userId: alert.userId, studentAlertId: alert.id, accommodationId: m.id, source: 'alert' })
    }

    alertJobRows.push(...(await matchSimilarJobRows(alert, available)))
  }

  // Favoris : toutes les résidences épinglées actuellement disponibles dans le périmètre.
  const favJobRows = (
    await db
      .select({ userId: favoriteAccommodations.userId, accommodationId: favoriteAccommodations.accommodationId })
      .from(favoriteAccommodations)
      .innerJoin(accommodations, eq(favoriteAccommodations.accommodationId, accommodations.id))
      .where(and(inScopeCondition, sql`${currentAvailableCount} > 0`))
  ).map(toFavoriteJobRow)

  const allJobRows = [...alertJobRows, ...favJobRows]

  if (options.verbose) {
    console.log(
      `  alertes actives : ${activeAlerts.length}, jobs alertes candidats : ${alertJobRows.length}, jobs favoris candidats : ${favJobRows.length}`,
    )
  }

  if (options.dryRun || allJobRows.length === 0) {
    return { alertsProcessed: activeAlerts.length, jobsCreated: allJobRows.length }
  }

  const jobsCreated = await insertAlertJobsInBatches(allJobRows)
  return { alertsProcessed: activeAlerts.length, jobsCreated }
}
