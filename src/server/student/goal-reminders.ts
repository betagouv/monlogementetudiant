import { and, eq, isNull, lt } from 'drizzle-orm'
import { parisMidnightUTC } from '~/server/bailleur/contact-digest'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { studentGoalLists, studentGoals } from '~/server/db/schema/student-goals'
import { sendStudentGoalReminderEmail } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'

/**
 * Rappel par e-mail des objectifs personnalisés arrivés à échéance (Trello).
 * Envoyé chaque matin, à partir du lendemain du jour civil (Europe/Paris) de l'échéance,
 * pour chaque objectif non terminé d'une liste dont les rappels sont activés.
 * `reminderSentAt` garantit un seul rappel par objectif, même si le cron rejoue.
 */

type GoalRemindersOptions = { dryRun?: boolean; verbose?: boolean; now?: Date; sendOutsideProduction?: boolean }

export type GoalRemindersResult = { sent: number; failures: string[] }

export async function runGoalReminders(options: GoalRemindersOptions = {}): Promise<GoalRemindersResult> {
  const now = options.now ?? new Date()
  const dueBefore = parisMidnightUTC(now)

  const goals = await db
    .select({ id: studentGoals.id, title: studentGoals.title, email: user.email })
    .from(studentGoals)
    .innerJoin(studentGoalLists, eq(studentGoals.listId, studentGoalLists.id))
    .innerJoin(user, eq(studentGoalLists.userId, user.id))
    .where(
      and(
        eq(studentGoalLists.emailRemindersEnabled, true),
        isNull(studentGoals.completedAt),
        isNull(studentGoals.reminderSentAt),
        lt(studentGoals.dueAt, dueBefore),
        eq(user.banned, false),
      ),
    )
    .orderBy(studentGoals.id)

  if (options.verbose || options.dryRun) {
    for (const goal of goals) {
      console.log(`  ${maskEmail(goal.email)} : « ${goal.title} »`)
    }
  }

  const result: GoalRemindersResult = { sent: 0, failures: [] }
  if (options.dryRun) return result

  for (const goal of goals) {
    try {
      await sendStudentGoalReminderEmail(goal.email, { goalTitle: goal.title }, { force: options.sendOutsideProduction })
      await db.update(studentGoals).set({ reminderSentAt: now }).where(eq(studentGoals.id, goal.id))
      result.sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failures.push(`objectif ${goal.id} (${maskEmail(goal.email)}) : ${message}`)
    }
  }

  return result
}
