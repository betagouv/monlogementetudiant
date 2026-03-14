import { bigint, boolean, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { academies } from './academies'
import { user } from './auth'
import { cities } from './cities'
import { departments } from './departments'

export const studentAlerts = pgTable(
  'student_alert',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
    departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id),
    academyId: bigint('academy_id', { mode: 'number' }).references(() => academies.id),
    hasColiving: boolean('has_coliving').notNull().default(false),
    isAccessible: boolean('is_accessible').notNull().default(false),
    maxPrice: integer('max_price').notNull(),
    receiveNotifications: boolean('receive_notifications').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('student_alert_user_id_idx').on(t.userId)],
)
