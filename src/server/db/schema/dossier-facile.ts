import { index, integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const dossierFacileTenants = pgTable(
  'dossier_facile_tenant',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().unique(),
    name: text('name'),
    status: text('status'),
    url: text('url'),
    pdfUrl: text('pdf_url'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dossier_facile_tenant_user_id_idx').on(t.userId)],
)

export const dossierFacileApplications = pgTable(
  'dossier_facile_application',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => dossierFacileTenants.id, { onDelete: 'cascade' }),
    accommodationSlug: varchar('accommodation_slug', { length: 255 }).notNull(),
    apartmentType: text('apartment_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.accommodationSlug)],
)
