import { and, count, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses, accommodations, alertJobs, cities, studentAlerts, user } from '~/server/db/schema'
import { env } from '~/server/env'
import { getAccommodationPath } from '~/utils/get-accommodation-url'
import { maskEmail } from '~/utils/mask-email'
import { sendStudentAlertEmail } from './brevo'

// Nombre maximal de tentatives d'envoi par job (1 envoi initial + retries).
// Au-delà, un job `failed` n'est plus replanifié et reste en échec définitif.
export const MAX_ATTEMPTS = 3

// Délai entre deux appels Brevo pour rester sous la limite de débit de l'API.
const BREVO_DELAY_MS = 100

export type AlertSenderResult = {
  sent: number
  failed: number
  requeued: number
  /**
   * Jobs qui viennent d'atteindre `MAX_ATTEMPTS` pendant ce run : ils ne seront plus
   * replanifiés, l'email étudiant est définitivement perdu. C'est le seul compteur qui
   * justifie d'alerter — un `failed` sous le plafond sera retenté au run suivant.
   */
  exhausted: number
}

// Un envoi = une alerte ou un groupe de favoris par utilisateur.
// Pour les alertes : un mail par alerte, pour éviter que la même résidence apparaisse
// dans deux emails (si elle matche deux alertes du même étudiant).
// Pour les favoris : un mail par utilisateur, regroupant tous ses favoris devenus disponibles.
type AlertBatch = {
  email: string
  firstname: string | null
  alertName: string
  jobIds: number[]
  accommodations: { nom: string; url: string }[]
}

export async function sendPendingAlertJobs(options: { dryRun?: boolean; verbose?: boolean } = {}): Promise<AlertSenderResult> {
  // Jobs en échec encore éligibles à une nouvelle tentative (sous le plafond).
  const retryableFailed = and(eq(alertJobs.status, 'failed'), lt(alertJobs.attempts, MAX_ATTEMPTS))

  // Replanification : on repasse ces jobs en `pending` (et on efface l'erreur précédente)
  // afin qu'ils soient repris par le traitement ci-dessous. En dry-run on ne touche pas
  // à la BDD : on se contente de les compter et de les inclure dans la sélection.
  let requeued = 0
  if (options.dryRun) {
    const [result] = await db.select({ value: count() }).from(alertJobs).where(retryableFailed)
    requeued = result?.value ?? 0
  } else {
    const rows = await db.update(alertJobs).set({ status: 'pending', error: null }).where(retryableFailed).returning({ id: alertJobs.id })
    requeued = rows.length
  }
  if (options.verbose && requeued > 0) {
    console.log(`  ↺ ${requeued} job(s) en échec replanifié(s) pour nouvelle tentative`)
  }

  // En exécution réelle, les jobs replanifiés sont déjà `pending`. En dry-run rien n'a été
  // écrit, donc on ajoute explicitement les `failed` éligibles à la sélection simulée.
  const selection = options.dryRun ? or(eq(alertJobs.status, 'pending'), retryableFailed) : eq(alertJobs.status, 'pending')

  const pendingJobs = await db
    .select({
      jobId: alertJobs.id,
      source: alertJobs.source,
      userId: alertJobs.userId,
      studentAlertId: alertJobs.studentAlertId,
      alertName: studentAlerts.name,
      userEmail: user.email,
      userFirstname: user.firstname,
      accommodationName: accommodations.name,
      accommodationSlug: accommodations.slug,
      cityName: cities.name,
    })
    .from(alertJobs)
    .innerJoin(user, eq(alertJobs.userId, user.id))
    // leftJoin : les jobs favoris n'ont pas de studentAlertId (null).
    .leftJoin(studentAlerts, eq(alertJobs.studentAlertId, studentAlerts.id))
    .innerJoin(accommodations, eq(alertJobs.accommodationId, accommodations.id))
    // Ville pour construire l'URL de détail. En `leftJoin` (+ adresse principale) pour ne
    // jamais écarter un job d'une résidence sans adresse principale/ville renseignée.
    .leftJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .where(selection)

  if (pendingJobs.length === 0) return { sent: 0, failed: 0, requeued, exhausted: 0 }

  // Clé de regroupement :
  // - alerte → 'alert:<studentAlertId>' (un email par alerte)
  // - favori  → 'favorite:<userId>'     (un email par utilisateur, tous favoris groupés)
  const byBatch = new Map<string, AlertBatch>()
  for (const job of pendingJobs) {
    const key = job.source === 'favorite' ? `favorite:${job.userId}` : `alert:${job.studentAlertId}`
    const batchAlertName = job.source === 'favorite' ? 'Mes favoris' : (job.alertName ?? 'Mon alerte')

    if (!byBatch.has(key)) {
      byBatch.set(key, {
        email: job.userEmail,
        firstname: job.userFirstname,
        alertName: batchAlertName,
        jobIds: [],
        accommodations: [],
      })
    }
    const batch = byBatch.get(key)!
    batch.jobIds.push(job.jobId)
    // Sans ville résolue, on retombe sur la page de recherche plutôt qu'un lien cassé.
    const path = job.cityName ? getAccommodationPath(job.cityName, job.accommodationSlug) : '/trouver-un-logement-etudiant'
    batch.accommodations.push({
      nom: job.accommodationName,
      url: `${env.BASE_URL}${path}`,
    })
  }

  let sent = 0
  let failed = 0
  let exhausted = 0

  for (const batch of byBatch.values()) {
    if (options.dryRun) {
      if (options.verbose) {
        console.log(`  [dry-run] ${maskEmail(batch.email)} — alerte « ${batch.alertName} » — ${batch.accommodations.length} logement(s)`)
      }
      sent++
      continue
    }

    try {
      await sendStudentAlertEmail(batch.email, {
        firstName: batch.firstname ?? '',
        alertName: batch.alertName,
        accommodations: batch.accommodations,
      })
      await db
        .update(alertJobs)
        .set({ status: 'sent', sentAt: new Date(), attempts: sql`${alertJobs.attempts} + 1` })
        .where(inArray(alertJobs.id, batch.jobIds))
      if (options.verbose) console.log(`  ✓ ${maskEmail(batch.email)} — ${batch.accommodations.length} logement(s)`)
      sent++
      await new Promise((resolve) => setTimeout(resolve, BREVO_DELAY_MS))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      // `returning` renvoie le compteur après incrément : on repère ainsi les jobs qui
      // franchissent le plafond sur ce run précis (un job ne peut le franchir qu'une fois,
      // puisqu'au-delà il n'est plus replanifié — donc pas de ré-alerte à chaque passage).
      const updated = await db
        .update(alertJobs)
        .set({ status: 'failed', error: errorMessage, attempts: sql`${alertJobs.attempts} + 1` })
        .where(inArray(alertJobs.id, batch.jobIds))
        .returning({ attempts: alertJobs.attempts })
      exhausted += updated.filter((job) => job.attempts >= MAX_ATTEMPTS).length
      console.error(`  ✗ ${maskEmail(batch.email)} — ${errorMessage}`)
      failed++
    }
  }

  return { sent, failed, requeued, exhausted }
}
