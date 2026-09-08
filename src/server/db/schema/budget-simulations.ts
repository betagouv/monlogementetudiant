import { bigint, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
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
  (t) => [unique('budget_simulation_user_id_unique').on(t.userId)],
)
