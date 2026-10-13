import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EStudentGoalDueDelay } from '~/enums/student-goal'
import { studentGoalLists, studentGoals } from '~/server/db/schema'
import { DAY_MS } from '~/utils/time'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { authenticatedCaller, authenticatedCaller2, caller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

beforeEach(async () => {
  await createUser({ id: 'test-user-id', email: 'test@test.com', name: 'Test User' })
  await createUser({ id: 'test-user-id-2', email: 'test2@test.com', name: 'Test User 2' })
})

const validInput = {
  emailRemindersEnabled: true,
  goals: [
    { title: 'Ajouter 3 résidences en favoris à Lille', dueDelay: EStudentGoalDueDelay.TWO_WEEKS },
    { title: 'Candidater dans 3 résidences autour de la fac', dueDelay: EStudentGoalDueDelay.ONE_WEEK },
  ],
}

describe('studentGoals.create', () => {
  it('crée la liste et ses objectifs avec échéances calculées', async () => {
    const { id } = await authenticatedCaller.studentGoals.create(validInput)

    const goals = await getTestDb().select().from(studentGoals).where(eq(studentGoals.listId, id)).orderBy(studentGoals.position)
    expect(goals).toHaveLength(2)
    expect(goals[0]).toMatchObject({ title: 'Ajouter 3 résidences en favoris à Lille', dueDelay: 'two_weeks', position: 0 })
    expect(goals[1]).toMatchObject({ title: 'Candidater dans 3 résidences autour de la fac', dueDelay: 'one_week', position: 1 })

    const expectedDueAt = Date.now() + 14 * DAY_MS
    expect(Math.abs(goals[0].dueAt.getTime() - expectedDueAt)).toBeLessThan(60_000)
    expect(goals[0].completedAt).toBeNull()
  })

  it('rejette un visiteur anonyme', async () => {
    await expect(caller.studentGoals.create(validInput)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejette une liste sans objectif', async () => {
    await expect(authenticatedCaller.studentGoals.create({ ...validInput, goals: [] })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('studentGoals.list', () => {
  it('ne renvoie que les listes de l’utilisateur connecté, objectifs ordonnés', async () => {
    await authenticatedCaller.studentGoals.create(validInput)
    await authenticatedCaller2.studentGoals.create({
      emailRemindersEnabled: false,
      goals: [{ title: 'Objectif d’un autre étudiant', dueDelay: EStudentGoalDueDelay.ONE_MONTH }],
    })

    const lists = await authenticatedCaller.studentGoals.list()
    expect(lists).toHaveLength(1)
    expect(lists[0].emailRemindersEnabled).toBe(true)
    expect(lists[0].goals.map((goal) => goal.title)).toEqual([
      'Ajouter 3 résidences en favoris à Lille',
      'Candidater dans 3 résidences autour de la fac',
    ])
    expect(lists[0].goals[0].isCompleted).toBe(false)
  })
})

describe('studentGoals.toggleGoal', () => {
  it('coche puis décoche un objectif', async () => {
    const { id } = await authenticatedCaller.studentGoals.create(validInput)
    const [list] = await authenticatedCaller.studentGoals.list()
    const goalId = list.goals[0].id

    await authenticatedCaller.studentGoals.toggleGoal({ goalId, isCompleted: true })
    let [row] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.id, goalId))
    expect(row.completedAt).not.toBeNull()

    await authenticatedCaller.studentGoals.toggleGoal({ goalId, isCompleted: false })
    ;[row] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.id, goalId))
    expect(row.completedAt).toBeNull()

    expect(id).toBe(list.id)
  })

  it('rejette un objectif appartenant à un autre utilisateur', async () => {
    await authenticatedCaller.studentGoals.create(validInput)
    const [list] = await authenticatedCaller.studentGoals.list()

    await expect(authenticatedCaller2.studentGoals.toggleGoal({ goalId: list.goals[0].id, isCompleted: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('studentGoals.update', () => {
  it('met à jour le titre, supprime et ajoute des objectifs', async () => {
    const { id } = await authenticatedCaller.studentGoals.create(validInput)
    const [list] = await authenticatedCaller.studentGoals.list()
    const [keptGoal, removedGoal] = list.goals

    await authenticatedCaller.studentGoals.update({
      listId: id,
      emailRemindersEnabled: false,
      goals: [
        { id: keptGoal.id, title: 'Titre modifié', dueDelay: keptGoal.dueDelay as EStudentGoalDueDelay },
        { title: 'Nouvel objectif', dueDelay: EStudentGoalDueDelay.ONE_MONTH },
      ],
    })

    const goals = await getTestDb().select().from(studentGoals).where(eq(studentGoals.listId, id)).orderBy(studentGoals.position)
    expect(goals).toHaveLength(2)
    expect(goals[0]).toMatchObject({ id: keptGoal.id, title: 'Titre modifié' })
    expect(goals[1]).toMatchObject({ title: 'Nouvel objectif', dueDelay: 'one_month' })
    expect(goals.some((goal) => goal.id === removedGoal.id)).toBe(false)

    const [listRow] = await getTestDb().select().from(studentGoalLists).where(eq(studentGoalLists.id, id))
    expect(listRow.emailRemindersEnabled).toBe(false)
  })

  it('conserve la date d’échéance si le choix n’a pas changé, la recalcule sinon', async () => {
    const { id } = await authenticatedCaller.studentGoals.create(validInput)
    const [list] = await authenticatedCaller.studentGoals.list()
    const goal = list.goals[0]

    // Vieillit artificiellement l'échéance pour distinguer conservation et recalcul.
    const agedDueAt = new Date(Date.now() - 3 * DAY_MS)
    await getTestDb().update(studentGoals).set({ dueAt: agedDueAt }).where(eq(studentGoals.id, goal.id))

    await authenticatedCaller.studentGoals.update({
      listId: id,
      emailRemindersEnabled: true,
      goals: [{ id: goal.id, title: goal.title, dueDelay: goal.dueDelay as EStudentGoalDueDelay }],
    })
    let [row] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.id, goal.id))
    expect(Math.abs(row.dueAt.getTime() - agedDueAt.getTime())).toBeLessThan(1000)

    await authenticatedCaller.studentGoals.update({
      listId: id,
      emailRemindersEnabled: true,
      goals: [{ id: goal.id, title: goal.title, dueDelay: EStudentGoalDueDelay.ONE_MONTH }],
    })
    ;[row] = await getTestDb().select().from(studentGoals).where(eq(studentGoals.id, goal.id))
    expect(Math.abs(row.dueAt.getTime() - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000)
  })

  it('rejette la mise à jour de la liste d’un autre utilisateur', async () => {
    const { id } = await authenticatedCaller.studentGoals.create(validInput)

    await expect(
      authenticatedCaller2.studentGoals.update({
        listId: id,
        emailRemindersEnabled: true,
        goals: [{ title: 'Tentative', dueDelay: EStudentGoalDueDelay.ONE_WEEK }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
