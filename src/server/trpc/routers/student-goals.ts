import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { type EStudentGoalDueDelay, STUDENT_GOAL_DUE_DELAY_DAYS } from '~/enums/student-goal'
import { ZStudentGoalListCreate, ZStudentGoalListUpdate } from '~/schemas/student-goals/student-goal-list'
import { db } from '~/server/db'
import { studentGoalLists, studentGoals } from '~/server/db/schema/student-goals'
import { DAY_MS } from '~/utils/time'
import { createTRPCRouter, userProcedure } from '../init'

const dueAtFromDelay = (delay: EStudentGoalDueDelay) => new Date(Date.now() + STUDENT_GOAL_DUE_DELAY_DAYS[delay] * DAY_MS)

export const studentGoalsRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const lists = await db
      .select()
      .from(studentGoalLists)
      .where(eq(studentGoalLists.userId, userId))
      .orderBy(asc(studentGoalLists.createdAt), asc(studentGoalLists.id))

    if (lists.length === 0) return []

    const goals = await db
      .select()
      .from(studentGoals)
      .where(
        inArray(
          studentGoals.listId,
          lists.map((list) => list.id),
        ),
      )
      .orderBy(asc(studentGoals.position), asc(studentGoals.id))

    return lists.map((list) => ({
      id: list.id,
      emailRemindersEnabled: list.emailRemindersEnabled,
      goals: goals
        .filter((goal) => goal.listId === list.id)
        .map((goal) => ({
          id: goal.id,
          title: goal.title,
          dueDelay: goal.dueDelay,
          dueAt: goal.dueAt,
          isCompleted: goal.completedAt != null,
        })),
    }))
  }),

  create: userProcedure.input(ZStudentGoalListCreate).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    return db.transaction(async (tx) => {
      const [list] = await tx.insert(studentGoalLists).values({ userId, emailRemindersEnabled: input.emailRemindersEnabled }).returning()

      await tx.insert(studentGoals).values(
        input.goals.map((goal, position) => ({
          listId: list.id,
          title: goal.title,
          dueDelay: goal.dueDelay,
          dueAt: dueAtFromDelay(goal.dueDelay),
          position,
        })),
      )

      return { id: list.id }
    })
  }),

  update: userProcedure.input(ZStudentGoalListUpdate).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const [list] = await db
      .select({ id: studentGoalLists.id })
      .from(studentGoalLists)
      .where(and(eq(studentGoalLists.id, input.listId), eq(studentGoalLists.userId, userId)))

    if (!list) throw new TRPCError({ code: 'NOT_FOUND' })

    const existingGoals = await db.select().from(studentGoals).where(eq(studentGoals.listId, list.id))

    await db.transaction(async (tx) => {
      await tx
        .update(studentGoalLists)
        .set({ emailRemindersEnabled: input.emailRemindersEnabled, updatedAt: new Date() })
        .where(eq(studentGoalLists.id, list.id))

      const keptIds = new Set(input.goals.map((goal) => goal.id).filter((id): id is number => id != null))
      const removedIds = existingGoals.filter((goal) => !keptIds.has(goal.id)).map((goal) => goal.id)
      if (removedIds.length > 0) {
        await tx.delete(studentGoals).where(inArray(studentGoals.id, removedIds))
      }

      for (const [position, goal] of input.goals.entries()) {
        const existing = goal.id != null ? existingGoals.find((row) => row.id === goal.id) : undefined

        if (existing) {
          // L'échéance n'est recalculée que si l'étudiant a changé son choix dans le sélecteur.
          const dueDelayChanged = existing.dueDelay !== goal.dueDelay
          await tx
            .update(studentGoals)
            .set({
              title: goal.title,
              position,
              ...(dueDelayChanged ? { dueDelay: goal.dueDelay, dueAt: dueAtFromDelay(goal.dueDelay) } : {}),
            })
            .where(eq(studentGoals.id, existing.id))
        } else {
          await tx.insert(studentGoals).values({
            listId: list.id,
            title: goal.title,
            dueDelay: goal.dueDelay,
            dueAt: dueAtFromDelay(goal.dueDelay),
            position,
          })
        }
      }
    })

    return { success: true }
  }),

  toggleGoal: userProcedure.input(z.object({ goalId: z.number(), isCompleted: z.boolean() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const [row] = await db
      .select({ id: studentGoals.id })
      .from(studentGoals)
      .innerJoin(studentGoalLists, eq(studentGoals.listId, studentGoalLists.id))
      .where(and(eq(studentGoals.id, input.goalId), eq(studentGoalLists.userId, userId)))

    if (!row) throw new TRPCError({ code: 'NOT_FOUND' })

    await db
      .update(studentGoals)
      .set({ completedAt: input.isCompleted ? new Date() : null })
      .where(eq(studentGoals.id, input.goalId))

    return { success: true }
  }),
})
