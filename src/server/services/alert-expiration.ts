import { and, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import { db } from '~/server/db'
import { studentAlerts, user } from '~/server/db/schema'
import { env } from '~/server/env'
import { maskEmail } from '~/utils/mask-email'
import { DAY_MS } from '~/utils/time'
import { sendAlertDeactivationEmail, sendAlertExpiryReminderEmail } from './brevo'

export const ALERT_LIFETIME_DAYS = 90
export const ALERT_EXPIRY_REMINDER_DAYS = 7

const ALERTS_URL = `${env.BASE_URL}/mon-espace/alertes`

type ExpirationOptions = { dryRun?: boolean; verbose?: boolean; now?: Date }

export async function sendExpiryReminders(options: ExpirationOptions = {}): Promise<{ reminded: number }> {
  const now = options.now ?? new Date()
  const threshold = new Date(now.getTime() - ALERT_LIFETIME_DAYS * DAY_MS)

  const candidates = await db
    .select({ id: studentAlerts.id, name: studentAlerts.name, email: user.email })
    .from(studentAlerts)
    .innerJoin(user, eq(studentAlerts.userId, user.id))
    .where(
      and(
        eq(studentAlerts.receiveNotifications, true),
        isNull(studentAlerts.expiryReminderSentAt),
        lte(studentAlerts.renewedAt, threshold),
      ),
    )

  if (options.verbose) console.log(`  Relances candidates : ${candidates.length}`)

  if (options.dryRun) return { reminded: candidates.length }

  let reminded = 0
  for (const alert of candidates) {
    try {
      await sendAlertExpiryReminderEmail(alert.email, { alertName: alert.name, alertsUrl: ALERTS_URL })
      await db.update(studentAlerts).set({ expiryReminderSentAt: now }).where(eq(studentAlerts.id, alert.id))
      if (options.verbose) console.log(`  ↺ relance envoyée : ${maskEmail(alert.email)} — « ${alert.name} »`)
      reminded++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ relance échouée (${maskEmail(alert.email)}) : ${message}`)
    }
  }

  return { reminded }
}

export async function expireStaleAlerts(options: ExpirationOptions = {}): Promise<{ deactivated: number }> {
  const now = options.now ?? new Date()
  const threshold = new Date(now.getTime() - ALERT_EXPIRY_REMINDER_DAYS * DAY_MS)

  const candidates = await db
    .select({ id: studentAlerts.id, name: studentAlerts.name, email: user.email })
    .from(studentAlerts)
    .innerJoin(user, eq(studentAlerts.userId, user.id))
    .where(
      and(
        eq(studentAlerts.receiveNotifications, true),
        isNotNull(studentAlerts.expiryReminderSentAt),
        lte(studentAlerts.expiryReminderSentAt, threshold),
      ),
    )

  if (options.verbose) console.log(`  Désactivations candidates : ${candidates.length}`)

  if (options.dryRun) return { deactivated: candidates.length }

  let deactivated = 0
  for (const alert of candidates) {
    try {
      await sendAlertDeactivationEmail(alert.email, { alertName: alert.name, alertsUrl: ALERTS_URL })
      await db.update(studentAlerts).set({ receiveNotifications: false, expiredAt: now }).where(eq(studentAlerts.id, alert.id))
      if (options.verbose) console.log(`  ⨯ alerte désactivée : ${maskEmail(alert.email)} — « ${alert.name} »`)
      deactivated++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ désactivation échouée (${maskEmail(alert.email)}) : ${message}`)
    }
  }

  return { deactivated }
}
