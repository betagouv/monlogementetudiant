import { bigint, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'
import { cities } from './cities'
import { departments } from './departments'
import { owners } from './owners'

export const trackingEvents = pgTable(
  'tracking_event',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    type: varchar({ length: 50 }).notNull(),

    cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
    departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id),
    accommodationId: bigint('accommodation_id', { mode: 'number' }).references(() => accommodations.id, { onDelete: 'cascade' }),
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id, { onDelete: 'cascade' }),

    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    sessionId: varchar('session_id', { length: 64 }),

    metadata: jsonb(),
  },
  (t) => [
    index('tracking_event_type_created_idx').on(t.type, t.createdAt),
    index('tracking_event_city_created_idx').on(t.cityId, t.createdAt),
    index('tracking_event_department_created_idx').on(t.departmentId, t.createdAt),
    index('tracking_event_accommodation_created_idx').on(t.accommodationId, t.createdAt),
    index('tracking_event_owner_created_idx').on(t.ownerId, t.createdAt),
    index('tracking_event_session_created_idx').on(t.sessionId, t.createdAt),
  ],
)
