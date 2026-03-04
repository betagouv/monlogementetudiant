import { bigint, boolean, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { academies } from './academies'
import { cities } from './cities'
import { departments } from './departments'

export const studentAlerts = pgTable('student_alert', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
  departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id),
  academyId: bigint('academy_id', { mode: 'number' }).references(() => academies.id),
  hasColiving: boolean('has_coliving').notNull().default(false),
  isAccessible: boolean('is_accessible').notNull().default(false),
  maxPrice: integer('max_price').notNull(),
  receiveNotifications: boolean('receive_notifications').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
})
