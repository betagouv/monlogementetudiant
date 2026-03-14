import { bigint, boolean, customType, pgTable, varchar } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const owners = pgTable('account_owner', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull().unique(),
  url: varchar({ length: 500 }),
  image: bytea('image'),
  acceptDossierFacileApplications: boolean('accept_dossier_facile_applications').notNull().default(false),
})
