import { and, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { EXPANDED_SEARCH_PAGE_SIZE } from '~/lib/accommodations-expanded-search'
import { db } from '~/server/db'
import { accommodationAddresses, accommodations, alertJobs, cities, studentAlerts, user } from '~/server/db/schema'
import { env } from '~/server/env'
import { enqueueJob } from '~/server/jobs/enqueue'
import { getAccommodationPath } from '~/utils/get-accommodation-url'
import { maskEmail } from '~/utils/mask-email'
import { sendStudentAlertEmail } from './brevo'

export const MAX_ATTEMPTS = 3

const BREVO_DELAY_MS = 100
const ALERT_BATCH_DELAY_MS = 60_000
export const ALERT_SEND_QUEUE = 'alert-send'

// Un lot = un e-mail : une alerte (alert + similar), ou tous les favoris d'un étudiant.
export type TAlertBatchKey = { kind: 'alert'; studentAlertId: number } | { kind: 'favorite'; userId: string }

export function alertBatchJobKey(key: TAlertBatchKey): string {
  return key.kind === 'alert' ? `alert:${key.studentAlertId}` : `favorite:${key.userId}`
}

export function alertBatchKeyOf(row: {
  source: 'alert' | 'favorite' | 'similar'
  userId: string
  studentAlertId: number | null
}): TAlertBatchKey | null {
  if (row.source === 'favorite') return { kind: 'favorite', userId: row.userId }
  if (row.studentAlertId == null) return null
  return { kind: 'alert', studentAlertId: row.studentAlertId }
}

export async function enqueueAlertBatch(conn: Pick<typeof db, 'execute'>, key: TAlertBatchKey): Promise<void> {
  await enqueueJob(conn, 'send-alert-batch', key, {
    jobKey: alertBatchJobKey(key),
    jobKeyMode: 'preserve_run_at',
    runAt: new Date(Date.now() + ALERT_BATCH_DELAY_MS),
    maxAttempts: MAX_ATTEMPTS,
    queueName: ALERT_SEND_QUEUE,
  })
}

function batchCondition(key: TAlertBatchKey): SQL | undefined {
  return key.kind === 'alert'
    ? and(eq(alertJobs.studentAlertId, key.studentAlertId), inArray(alertJobs.source, ['alert', 'similar']))
    : and(eq(alertJobs.userId, key.userId), eq(alertJobs.source, 'favorite'))
}

export async function sendAlertBatch(
  key: TAlertBatchKey,
  attempt: { number: number; max: number },
): Promise<{ sent: boolean; housings: number }> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] lot ${alertBatchJobKey(key)} non envoyé hors production`)
    return { sent: false, housings: 0 }
  }

  const rows = await db
    .select({
      jobId: alertJobs.id,
      source: alertJobs.source,
      alertName: studentAlerts.name,
      userEmail: user.email,
      userFirstname: user.firstname,
      accommodationName: accommodations.name,
      accommodationSlug: accommodations.slug,
      cityName: cities.name,
    })
    .from(alertJobs)
    .innerJoin(user, eq(alertJobs.userId, user.id))
    .leftJoin(studentAlerts, eq(alertJobs.studentAlertId, studentAlerts.id))
    .innerJoin(accommodations, eq(alertJobs.accommodationId, accommodations.id))
    .leftJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .where(and(eq(alertJobs.status, 'pending'), batchCondition(key)))
    .orderBy(alertJobs.id)

  if (rows.length === 0) return { sent: false, housings: 0 }

  const [first] = rows
  const alertName = key.kind === 'favorite' ? 'Mes favoris' : (first.alertName ?? 'Mon alerte')
  const housings: { nom: string; url: string }[] = []
  // Les suggestions sont plafonnées ; les lignes excédentaires sont soldées avec le lot.
  const suggestions: { nom: string; url: string }[] = []
  for (const row of rows) {
    const path = row.cityName ? getAccommodationPath(row.cityName, row.accommodationSlug) : '/trouver-un-logement-etudiant'
    const line = { nom: row.accommodationName, url: `${env.BASE_URL}${path}` }
    if (row.source === 'similar') {
      if (suggestions.length < EXPANDED_SEARCH_PAGE_SIZE) suggestions.push(line)
    } else {
      housings.push(line)
    }
  }

  const jobIds = rows.map((row) => row.jobId)
  const sendId = crypto.randomUUID()

  try {
    await sendStudentAlertEmail(first.userEmail, {
      firstName: first.userFirstname ?? '',
      alertName,
      accommodations: housings,
      suggestions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    // Une ligne ne passe en échec définitif qu'à sa propre dernière tentative : une ligne arrivée
    // pendant les relances reste `pending` et sera reprise par `requeue-pending-alerts`.
    await db
      .update(alertJobs)
      .set({
        attempts: sql`${alertJobs.attempts} + 1`,
        error: message,
        sendId,
        status: sql`case when ${alertJobs.attempts} + 1 >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end::alert_job_status`,
      })
      .where(inArray(alertJobs.id, jobIds))
    console.error(`  ✗ ${maskEmail(first.userEmail)} — tentative ${attempt.number}/${attempt.max} — ${message}`)
    throw error
  }

  await db
    .update(alertJobs)
    .set({ status: 'sent', sentAt: new Date(), sendId, attempts: sql`${alertJobs.attempts} + 1` })
    .where(inArray(alertJobs.id, jobIds))
  await new Promise((resolve) => setTimeout(resolve, BREVO_DELAY_MS))

  return { sent: true, housings: housings.length + suggestions.length }
}
