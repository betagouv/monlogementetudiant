import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth'

// Doit rester synchronisé avec `EStudentGoalDueDelay` (src/enums/student-goal.ts).
export const studentGoalDueDelayEnum = pgEnum('student_goal_due_delay', ['one_week', 'two_weeks', 'one_month'])

/** Liste d'objectifs personnalisés créée par un étudiant depuis « Mon plan d'action ». */
export const studentGoalLists = pgTable(
  'student_goal_list',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    emailRemindersEnabled: boolean('email_reminders_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('student_goal_list_user_id_idx').on(t.userId)],
)

/**
 * Objectif individuel d'une liste. `dueDelay` conserve le choix affiché dans le
 * sélecteur ; `dueAt` est la date absolue calculée à l'enregistrement, utilisée
 * plus tard pour les rappels par e-mail.
 */
export const studentGoals = pgTable(
  'student_goal',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    listId: bigint('list_id', { mode: 'number' })
      .notNull()
      .references(() => studentGoalLists.id, { onDelete: 'cascade' }),
    title: varchar({ length: 255 }).notNull(),
    dueDelay: studentGoalDueDelayEnum('due_delay').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    position: integer().notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('student_goal_list_id_idx').on(t.listId)],
)
