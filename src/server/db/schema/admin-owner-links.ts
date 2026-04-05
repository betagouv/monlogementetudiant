import { bigint, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { owners } from './owners'

export const adminOwnerLinks = pgTable(
  'admin_owner_link',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ownerId: bigint('owner_id', { mode: 'number' })
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('admin_owner_link_user_owner_idx').on(t.userId, t.ownerId),
    index('admin_owner_link_user_id_idx').on(t.userId),
    index('admin_owner_link_owner_id_idx').on(t.ownerId),
  ],
)
