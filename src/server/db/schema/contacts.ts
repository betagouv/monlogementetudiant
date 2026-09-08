import { sql } from 'drizzle-orm'
import { bigint, date, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { EContactStatus } from '~/enums/contact-status'
import { accommodations } from './accommodations'
import { scholarshipStatusEnum, user } from './auth'

export const contactRequests = pgTable(
  'contact_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    firstname: text('firstname'),
    lastname: text('lastname'),
    email: text('email'),
    phone: text('phone'),
    /**
     * Infos étudiant saisies dans le formulaire « Être recontacté ». Renseignées aussi pour un
     * visiteur sans compte ; côté compte connecté elles doublent celles du profil, qui restent la
     * référence si elles changent après coup.
     */
    birthdate: date('birthdate', { mode: 'string' }),
    scholarshipStatus: scholarshipStatusEnum('scholarship_status'),
    apartmentType: text('apartment_type'),
    /** HMAC de l'IP émettrice (jamais l'IP en clair) — sert au rate-limit anti-spam des demandes visiteur. */
    ipHash: text('ip_hash'),
    /**
     * Double opt-in : `null` tant que le visiteur n'a pas cliqué le lien reçu par e-mail. Les
     * demandes d'un étudiant connecté sont confirmées d'office (adresse déjà vérifiée par Better Auth).
     */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /** Purge RGPD : date à laquelle les coordonnées ont été vidées. `null` = PII encore présente. */
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    status: text('status').$type<EContactStatus>().notNull().default(EContactStatus.A_CONTACTER),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.accommodationId),
    uniqueIndex('contact_request_guest_email_accommodation_unique')
      .on(t.accommodationId, sql`lower(${t.email})`)
      .where(sql`${t.userId} is null`),
    index('contact_request_accommodation_id_idx').on(t.accommodationId),
    // Rattachement des demandes visiteur à un compte après vérification de l'e-mail.
    index('contact_request_guest_email_idx').on(sql`lower(${t.email})`).where(sql`${t.userId} is null`),
    // Fenêtre glissante du rate-limit.
    index('contact_request_ip_hash_created_at_idx').on(t.ipHash, t.createdAt),
    // Balayage du cron de purge : ne visite que les lignes portant encore des coordonnées.
    index('contact_request_purge_idx').on(t.createdAt).where(sql`${t.anonymizedAt} is null`),
  ],
)
