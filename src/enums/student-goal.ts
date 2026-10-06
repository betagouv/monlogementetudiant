import { z } from 'zod'

/** Échéance relative proposée pour un objectif personnalisé (« Pour quand ? »). */
export enum EStudentGoalDueDelay {
  ONE_WEEK = 'one_week',
  TWO_WEEKS = 'two_weeks',
  ONE_MONTH = 'one_month',
}

export const STUDENT_GOAL_DUE_DELAYS = Object.values(EStudentGoalDueDelay)

export const ZStudentGoalDueDelay = z.enum(EStudentGoalDueDelay)

export const STUDENT_GOAL_DUE_DELAY_DAYS: Record<EStudentGoalDueDelay, number> = {
  [EStudentGoalDueDelay.ONE_WEEK]: 7,
  [EStudentGoalDueDelay.TWO_WEEKS]: 14,
  [EStudentGoalDueDelay.ONE_MONTH]: 30,
}
