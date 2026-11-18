import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { user } from './auth'

export const housingAidSimulations = pgTable(
  'housing_aid_simulation',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Inputs bruts de la simulation (HelpSimulatorFormData) — les résultats sont recalculés via calculateAllAids()
    inputs: jsonb('inputs').notNull().$type<HelpSimulatorFormData>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  // Une ligne par version de simulation ; l'étudiant ne voit que la plus récente.
  (t) => [index('housing_aid_simulation_user_id_updated_at_idx').on(t.userId, t.updatedAt)],
)
