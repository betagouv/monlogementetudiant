import { sql } from 'drizzle-orm'
import { bigint, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'
import { cities } from './cities'
import { departments } from './departments'
import { owners } from './owners'

export const trackingEvents = pgTable(
  'tracking_event',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    type: varchar({ length: 50 }).notNull(),

    cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
    departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id),
    accommodationId: bigint('accommodation_id', { mode: 'number' }).references(() => accommodations.id, { onDelete: 'cascade' }),
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id, { onDelete: 'cascade' }),

    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    sessionId: varchar('session_id', { length: 64 }),

    metadata: jsonb(),
  },
  /**
   * La table est de très loin la plus volumineuse de la base : ses index doivent rester légers.
   *
   * 1. **Index partiels sur les colonnes majoritairement NULL.** Un btree indexe les NULL. Toutes
   *    les requêtes filtrent ces colonnes par `=` ou `IN`, ce qui implique `IS NOT NULL` —
   *    PostgreSQL sait le prouver et utilise l'index partiel.
   *
   * 2. **Pas d'index sur `type` seul.** La colonne n'a que 4 valeurs distinctes et n'est jamais
   *    interrogée sans un `owner_id` / `city_id` / `department_id` / `session_id` à côté
   *    (`owner-statistics.ts`, `tracking-event-logger.ts`) : le planner passe par les index ci-dessous.
   */
  (t) => [
    // `city_id` n'est NULL que sur les recherches par département : un index partiel
    // n'économiserait rien et coûterait une reconstruction. On le laisse complet.
    index('tracking_event_city_created_idx').on(t.cityId, t.createdAt),
    index('tracking_event_department_created_idx').on(t.departmentId, t.createdAt).where(sql`${t.departmentId} is not null`),
    index('tracking_event_accommodation_created_idx').on(t.accommodationId, t.createdAt).where(sql`${t.accommodationId} is not null`),
    index('tracking_event_owner_created_idx').on(t.ownerId, t.createdAt).where(sql`${t.ownerId} is not null`),
    // Sert la fenêtre de déduplication (24 h) de `tracking-event-logger.ts`. `session_id` est
    // toujours renseigné : rien à gagner en partiel ici.
    index('tracking_event_session_created_idx').on(t.sessionId, t.createdAt),
    // Sert la clé étrangère `ON DELETE SET NULL` : sans lui, chaque suppression de compte parcourt toute
    // la table. `user_id` n'est renseigné que pour les visiteurs connectés, d'où l'index partiel.
    index('tracking_event_user_id_idx').on(t.userId).where(sql`${t.userId} is not null`),
  ],
)
