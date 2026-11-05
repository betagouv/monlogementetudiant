import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EStudentGoalDueDelay } from '~/enums/student-goal'
import { studentGoals } from '~/server/db/schema'
import { runGoalReminders } from '~/server/student/goal-reminders'
import { DAY_MS } from '~/utils/time'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { authenticatedCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const { reminderEmail } = vi.hoisted(() => ({ reminderEmail: vi.fn().mockResolvedValue(undefined) }))

vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendStudentGoalReminderEmail: reminderEmail }
})

// Mercredi 15 octobre 2026, 7 h UTC (9 h à Paris) : l'heure du cron quotidien.
const NOW = new Date('2026-10-15T07:00:00Z')

const createList = async (emailRemindersEnabled: boolean, titles: string[]) => {
  const { id } = await authenticatedCaller.studentGoals.create({
    emailRemindersEnabled,
    goals: titles.map((title) => ({ title, dueDelay: EStudentGoalDueDelay.ONE_WEEK })),
  })
  return id
}

const setDueAt = async (title: string, dueAt: Date) => {
  await getTestDb().update(studentGoals).set({ dueAt }).where(eq(studentGoals.title, title))
}

beforeEach(async () => {
  reminderEmail.mockClear()
  await createUser({ id: 'test-user-id', email: 'test@test.com', name: 'Test User' })
})

describe('runGoalReminders', () => {
  it('rappelle une seule fois chaque objectif échu d’une liste avec rappels activés', async () => {
    await createList(true, ['Objectif échu', 'Objectif à venir'])
    await setDueAt('Objectif échu', new Date(NOW.getTime() - DAY_MS))
    await setDueAt('Objectif à venir', new Date(NOW.getTime() + 7 * DAY_MS))

    const result = await runGoalReminders({ now: NOW, sendOutsideProduction: true })

    expect(result).toEqual({ sent: 1, failures: [] })
    expect(reminderEmail).toHaveBeenCalledTimes(1)
    expect(reminderEmail).toHaveBeenCalledWith('test@test.com', { goalTitle: 'Objectif échu' }, { force: true })

    const [reminded] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.title, 'Objectif échu'))
    expect(reminded.reminderSentAt).toEqual(NOW)

    reminderEmail.mockClear()
    expect(await runGoalReminders({ now: NOW, sendOutsideProduction: true })).toEqual({ sent: 0, failures: [] })
    expect(reminderEmail).not.toHaveBeenCalled()
  })

  it('attend le lendemain de l’échéance (jour civil Paris) avant de rappeler', async () => {
    await createList(true, ['Échéance du jour'])
    // Échu aujourd'hui à 1 h à Paris : rappel seulement à partir de demain.
    await setDueAt('Échéance du jour', new Date('2026-10-14T23:00:00Z'))

    expect(await runGoalReminders({ now: NOW, sendOutsideProduction: true })).toEqual({ sent: 0, failures: [] })

    const tomorrow = new Date(NOW.getTime() + DAY_MS)
    expect(await runGoalReminders({ now: tomorrow, sendOutsideProduction: true })).toEqual({ sent: 1, failures: [] })
  })

  it('ignore les objectifs terminés et les listes sans rappels', async () => {
    await createList(true, ['Objectif terminé'])
    await createList(false, ['Objectif sans rappels'])
    await setDueAt('Objectif terminé', new Date(NOW.getTime() - DAY_MS))
    await setDueAt('Objectif sans rappels', new Date(NOW.getTime() - DAY_MS))
    await getTestDb().update(studentGoals).set({ completedAt: NOW }).where(eq(studentGoals.title, 'Objectif terminé'))

    expect(await runGoalReminders({ now: NOW, sendOutsideProduction: true })).toEqual({ sent: 0, failures: [] })
    expect(reminderEmail).not.toHaveBeenCalled()
  })

  it('liste sans envoyer en dry-run', async () => {
    await createList(true, ['Objectif échu'])
    await setDueAt('Objectif échu', new Date(NOW.getTime() - DAY_MS))

    expect(await runGoalReminders({ now: NOW, dryRun: true })).toEqual({ sent: 0, failures: [] })
    expect(reminderEmail).not.toHaveBeenCalled()

    const [goal] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.title, 'Objectif échu'))
    expect(goal.reminderSentAt).toBeNull()
  })

  it('continue après un échec d’envoi et ne marque pas l’objectif concerné', async () => {
    await createList(true, ['Objectif en échec'])
    await createList(true, ['Objectif suivant'])
    await setDueAt('Objectif en échec', new Date(NOW.getTime() - DAY_MS))
    await setDueAt('Objectif suivant', new Date(NOW.getTime() - DAY_MS))
    reminderEmail.mockRejectedValueOnce(new Error('Brevo indisponible'))

    const result = await runGoalReminders({ now: NOW, sendOutsideProduction: true })

    expect(result.sent).toBe(1)
    expect(result.failures).toHaveLength(1)
    const [failed] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.title, 'Objectif en échec'))
    expect(failed.reminderSentAt).toBeNull()
  })
})
