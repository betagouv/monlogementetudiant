import { z } from 'zod'
import { ZStudentGoalDueDelay } from '~/enums/student-goal'
import { frSchemaTranslator, type TSchemaTranslator } from '~/schemas/schema-translator'

export const STUDENT_GOAL_TITLE_MAX_LENGTH = 255
export const STUDENT_GOALS_MAX_PER_LIST = 10

export const createZStudentGoalListCreate = (t: TSchemaTranslator = frSchemaTranslator) =>
  z.object({
    emailRemindersEnabled: z.boolean(),
    goals: z
      .array(
        z.object({
          /** Présent uniquement en édition : identifiant de l'objectif conservé. */
          id: z.number().optional(),
          title: z
            .string()
            .trim()
            .min(1, t('errors.goalTitleRequired'))
            .max(STUDENT_GOAL_TITLE_MAX_LENGTH, t('errors.goalTitleMaxLength', { max: STUDENT_GOAL_TITLE_MAX_LENGTH })),
          dueDelay: ZStudentGoalDueDelay,
        }),
      )
      .min(1, t('errors.goalsRequired'))
      .max(STUDENT_GOALS_MAX_PER_LIST, t('errors.goalsTooMany', { max: STUDENT_GOALS_MAX_PER_LIST })),
  })

export const ZStudentGoalListCreate = createZStudentGoalListCreate()
export type TStudentGoalListCreate = z.infer<typeof ZStudentGoalListCreate>

export const createZStudentGoalListUpdate = (t: TSchemaTranslator = frSchemaTranslator) =>
  createZStudentGoalListCreate(t).extend({ listId: z.number() })

export const ZStudentGoalListUpdate = createZStudentGoalListUpdate()
export type TStudentGoalListUpdate = z.infer<typeof ZStudentGoalListUpdate>
