import { bigint, index, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { user } from './auth'
import { owners } from './owners'

export const loginAttemptStatusEnum = pgEnum('login_attempt_status', [
  ELoginAttemptStatus.EMAIL_SENT,
  ELoginAttemptStatus.COMPLETED,
  ELoginAttemptStatus.EXPIRED,
  ELoginAttemptStatus.INVALID,
])

export const loginAttempts = pgTable(
  'login_attempt',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    email: varchar({ length: 255 }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id, { onDelete: 'set null' }),
    /** Rôle du compte au moment de la demande : 'owner' | 'admin'. */
    role: varchar({ length: 20 }),

    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    status: loginAttemptStatusEnum().notNull().default(ELoginAttemptStatus.EMAIL_SENT),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** User-agent de la vérification : distingue un vrai navigateur d'un scanner de mails. */
    verifiedUserAgent: text('verified_user_agent'),
    /** Empreinte du cookie posé dans le navigateur à l'origine de la demande. */
    bindingHash: varchar('binding_hash', { length: 64 }),
    /** Session ouverte par la consommation du lien : révoquée si un scanner l'a consommé à la place du gestionnaire. */
    sessionId: text('session_id'),
    /** HMAC de l'IP à l'origine de la demande, pour plafonner les envois. */
    ipHash: varchar('ip_hash', { length: 64 }),
  },
  (table) => [
    index('login_attempt_created_at_idx').on(table.createdAt),
    index('login_attempt_owner_id_idx').on(table.ownerId),
    index('login_attempt_status_idx').on(table.status),
    index('login_attempt_email_created_at_idx').on(table.email, table.createdAt),
    index('login_attempt_ip_hash_created_at_idx').on(table.ipHash, table.createdAt),
  ],
)
