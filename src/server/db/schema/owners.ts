import { sql } from 'drizzle-orm'
import { bigint, boolean, customType, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { user } from './auth'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const ownerContactModeEnum = pgEnum('owner_contact_mode', [
  EOwnerContactMode.NONE,
  EOwnerContactMode.CONTACTS,
  EOwnerContactMode.DOSSIER_FACILE,
])

export const owners = pgTable('owner', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull().unique(),
  url: varchar({ length: 500 }),
  landingUrl: varchar('landing_url', { length: 500 }),
  image: bytea('image'),
  contactMode: ownerContactModeEnum('contact_mode').notNull().default(EOwnerContactMode.NONE),
  availabilityImported: boolean('availability_imported').notNull().default(false),

  // Traçabilité des modifications de la *fiche* bailleur (nom, URL, logo, mode de contact).
  // Volontairement NULL sur les lignes existantes et sur les owners créés par import/CLI : NULL se lit
  // "jamais modifiée depuis la mise en place du suivi", pas "modifiée à la date de la migration".
  // Les modifs de résidences/dispos ne touchent PAS ces colonnes — elles vivent dans `activity_log`.
  // Le `DEFAULT NULL` est un no-op côté Postgres mais indispensable côté Drizzle : sans `default`,
  // `$onUpdate` s'applique AUSSI à l'INSERT (drizzle-orm/pg-core/dialect.js), ce qui tamponnerait
  // les bailleurs à leur création et ferait perdre à NULL son sens de "jamais modifiée".
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .default(sql`null`)
    .$onUpdate(() => new Date()),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
})
