import { sql } from 'drizzle-orm'
import { bigint, boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const scholarshipStatusEnum = pgEnum('scholarship_status', ['yes', 'no', 'unknown'])
export const scholarshipTypeEnum = pgEnum('scholarship_type', [
  'crous_social',
  'crous_annual_specific',
  'french_government',
  'health_social_training',
  'other',
])
export const bailleurRoleEnum = pgEnum('bailleur_role', ['administrator', 'gestionnaire'])
export const bailleurPermissionEnum = pgEnum('bailleur_permission', [
  'manage_users',
  'manage_residences',
  'manage_availability',
  'manage_applications',
])

export const user = pgTable(
  'user',
  {
    id: text().primaryKey(),
    email: text().notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text().notNull(),
    image: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Custom fields
    firstname: text().notNull().default(''),
    lastname: text().notNull().default(''),
    role: text().notNull().default('user'), // 'user' | 'owner' | 'admin'
    legacyUser: boolean('legacy_user').notNull().default(false),
    legacyId: integer('legacy_id'),
    ownerId: bigint('owner_id', { mode: 'number' }),
    bailleurRole: bailleurRoleEnum('bailleur_role'),
    bailleurPermissions: bailleurPermissionEnum('bailleur_permissions').array().notNull().default(sql`ARRAY[]::bailleur_permission[]`),
    similarAccommodationAlertsEnabled: boolean('similar_accommodation_alerts_enabled').notNull().default(true),
    favoriteAlertsEnabled: boolean('favorite_alerts_enabled').notNull().default(true),
    // Infos étudiant (nullable : les comptes existants ne les ont pas → détection profil incomplet)
    phone: text('phone'),
    birthdate: date('birthdate', { mode: 'string' }), // 'YYYY-MM-DD'
    scholarshipStatus: scholarshipStatusEnum('scholarship_status'),
    scholarshipType: scholarshipTypeEnum('scholarship_type'),
  },
  (t) => [index('user_owner_id_idx').on(t.ownerId)],
)

export const session = pgTable('session', {
  id: text().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text().notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Depuis Better Auth 1.7, l'identité d'un compte est portée par le couple `(issuer, accountId)` et
 * plus par `accountId` seul. `issuer` est un espace de noms synthétique : `local:<providerId>` pour
 * les méthodes locales (chez nous uniquement `local:credential`), `local:oauth:<providerId>` pour un
 * provider OAuth sans issuer propre. La colonne est obligatoire côté lib — `sign-in` filtre dessus,
 * donc une valeur absente déconnecte le compte en silence plutôt que de lever une erreur.
 */
export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    issuer: text().notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text(),
    idToken: text('id_token'),
    password: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('account_issuer_account_id_idx').on(t.issuer, t.accountId)],
)

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
