import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { user } from './auth'

export const budgetSimulations = pgTable(
  'budget_simulation',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    inputs: jsonb('inputs').notNull().$type<TBudgetSimulation>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  // Une ligne par version de simulation ; l'étudiant ne voit que la plus récente.
  (t) => [index('budget_simulation_user_id_updated_at_idx').on(t.userId, t.updatedAt)],
)
