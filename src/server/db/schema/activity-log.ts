import { bigint, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const activityLog = pgTable(
  'activity_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    userId: text('user_id'),
    userName: varchar('user_name', { length: 255 }),

    action: varchar({ length: 100 }).notNull(),

    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    entityName: varchar('entity_name', { length: 255 }),

    ownerId: bigint('owner_id', { mode: 'number' }),
    ownerName: varchar('owner_name', { length: 255 }),

    metadata: jsonb(),
  },
  (table) => [
    index('activity_log_owner_id_idx').on(table.ownerId),
    index('activity_log_created_at_idx').on(table.createdAt),
    index('activity_log_action_idx').on(table.action),
  ],
)
