import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * Réglages d'interception des emails hors production (ADR 0003).
 *
 * Table singleton : une seule ligne, identifiée par la clé fixe `SINGLETON`. Les réglages
 * ne sont lus et éditables qu'en dehors de la production.
 */
export const emailInterceptionSettings = pgTable('email_interception_settings', {
  // Clé fixe garantissant l'unicité de la ligne (upsert toujours sur cette valeur).
  id: text().primaryKey().default('SINGLETON'),
  // Adresse catch-all de recette. Null = repli sur STAGING_EMAIL_REDIRECT puis drop.
  redirectEmail: text('redirect_email'),
  // Si vrai, les emails non-auth repartent vers leurs destinataires réels.
  bypassRedirect: boolean('bypass_redirect').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
})
