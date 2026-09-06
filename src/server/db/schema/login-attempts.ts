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

/**
 * Suivi du parcours de connexion des gestionnaires et des administrateurs, qui se fait
 * exclusivement par lien e-mail (magic link). Une ligne = un lien envoyé, complétée au moment
 * où le lien est vérifié.
 *
 * `email`, `userId` et `ownerId` sont nullables : une vérification peut arriver avec un jeton
 * qu'on ne sait rattacher à rien (lien forgé, tronqué par un client mail…), et ce cas est
 * précisément un signal à afficher.
 *
 * Le jeton lui-même n'est jamais stocké, seulement son SHA-256 : cette table sert au suivi, elle
 * ne doit pas devenir une seconde copie exploitable des identifiants de connexion.
 */
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
  },
  (table) => [
    index('login_attempt_created_at_idx').on(table.createdAt),
    index('login_attempt_owner_id_idx').on(table.ownerId),
    index('login_attempt_status_idx').on(table.status),
  ],
)
