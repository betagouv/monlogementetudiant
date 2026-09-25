import { sql } from 'drizzle-orm'
import { CONTACT_RETENTION_DAYS, EContactStatus } from '~/enums/contact-status'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { db } from '~/server/db'
import type { TCsvColumn } from '~/utils/csv'

export type TContactFollowUpRow = {
  id: number
  residence: string
  gestionnaire: string | null
  administrateurs: string | null
  derniere_connexion: string | null
  depot_active: boolean
  date_activation: string | null
  nb_recues: number
  derniere_reception: string | null
  nb_traitees: number
  dernier_changement_statut: string | null
  nb_en_attente: number
  nb_expirees_non_traitees: number
}

export const CONTACT_FOLLOW_UP_COLUMNS: TCsvColumn<TContactFollowUpRow>[] = [
  { key: 'id', header: 'ID' },
  { key: 'residence', header: 'Résidence' },
  { key: 'gestionnaire', header: 'Gestionnaire' },
  { key: 'administrateurs', header: 'Administrateurs (nom et email)' },
  { key: 'derniere_connexion', header: 'Dernière connexion d’un administrateur' },
  { key: 'depot_active', header: 'Dépôt de coordonnées activé' },
  { key: 'date_activation', header: 'Date d’activation du dépôt' },
  { key: 'nb_recues', header: 'Coordonnées reçues' },
  { key: 'derniere_reception', header: 'Dernière réception' },
  { key: 'nb_traitees', header: 'Coordonnées traitées' },
  { key: 'dernier_changement_statut', header: 'Dernier changement de statut' },
  { key: 'nb_en_attente', header: 'En attente de traitement' },
  { key: 'nb_expirees_non_traitees', header: 'Expirées sans traitement' },
]

const TREATED_STATUSES = sql`(${EContactStatus.CONTACTE}, ${EContactStatus.NON_RETENU})`
const RETENTION = sql`make_interval(days => ${CONTACT_RETENTION_DAYS}::int)`

const formatDate = (column: string) => sql.raw(`to_char(${column} AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY')`)

export const getContactFollowUpRows = async () => {
  return db.execute<TContactFollowUpRow>(sql`
    WITH managers AS (
      SELECT a.id AS accommodation_id, u.id AS user_id,
        concat_ws(' ', nullif(trim(concat_ws(' ', u.firstname, u.lastname)), ''), '<' || u.email || '>') AS label
      FROM accommodation a
      JOIN "user" u ON u.owner_id = a.owner_id AND u.role = 'owner'
      WHERE u.bailleur_role = 'administrator'
        OR (
          'manage_applications'::bailleur_permission = ANY(u.bailleur_permissions)
          AND (
            NOT u.application_scope_restricted
            OR EXISTS (SELECT 1 FROM bailleur_accommodation_scope s WHERE s.user_id = u.id AND s.accommodation_id = a.id)
          )
        )
    ),
    user_logins AS (
      SELECT user_id, max(at) AS last_login FROM (
        SELECT s.user_id, s.created_at AS at FROM "session" s
        WHERE s.user_id IN (SELECT user_id FROM managers)
          AND s.impersonated_by IS NULL
          AND s.created_at < coalesce((SELECT min(created_at) FROM login_attempt), 'infinity'::timestamptz)
        UNION ALL
        SELECT la.user_id, la.verified_at AS at FROM login_attempt la
        WHERE la.user_id IN (SELECT user_id FROM managers) AND la.status = ${ELoginAttemptStatus.COMPLETED}
      ) logins
      GROUP BY user_id
    ),
    managers_by_residence AS (
      SELECT m.accommodation_id,
        string_agg(m.label, ', ' ORDER BY m.label) AS labels,
        max(ul.last_login) AS last_login
      FROM managers m
      LEFT JOIN user_logins ul ON ul.user_id = m.user_id
      GROUP BY m.accommodation_id
    ),
    contacts AS (
      SELECT accommodation_id,
        count(*) AS received,
        max(created_at) AS last_received,
        count(*) FILTER (WHERE status IN ${TREATED_STATUSES}) AS treated,
        max(reviewed_at) FILTER (WHERE status IN ${TREATED_STATUSES}) AS last_status_change,
        count(*) FILTER (WHERE status NOT IN ${TREATED_STATUSES} AND created_at >= now() - ${RETENTION}) AS pending,
        count(*) FILTER (WHERE status NOT IN ${TREATED_STATUSES} AND created_at < now() - ${RETENTION}) AS expired
      FROM contact_request
      WHERE user_id IS NOT NULL OR confirmed_at IS NOT NULL
      GROUP BY accommodation_id
    ),
    mode_enabled AS (
      SELECT owner_id, max(created_at) AS at FROM activity_log
      WHERE action = 'owner.contact_mode_updated'
        AND metadata -> 'diff' -> 'contactMode' ->> 'new' = ${EOwnerContactMode.CONTACTS}
      GROUP BY owner_id
    ),
    resumed AS (
      SELECT entity_id, max(created_at) AS at FROM activity_log
      WHERE action = 'accommodation.applications_resumed' AND entity_type = 'accommodation'
      GROUP BY entity_id
    ),
    residences AS (
      SELECT a.id, a.name, o.name AS owner_name,
        (o.contact_mode = ${EOwnerContactMode.CONTACTS} AND a.accepts_applications AND a.applications_suspended_at IS NULL) AS active,
        greatest(me.at, r.at) AS activated_at
      FROM accommodation a
      JOIN owner o ON o.id = a.owner_id
      LEFT JOIN mode_enabled me ON me.owner_id = a.owner_id
      LEFT JOIN resumed r ON r.entity_id = a.id::text
    )
    SELECT
      res.id::int AS id,
      res.name AS residence,
      res.owner_name AS gestionnaire,
      mbr.labels AS administrateurs,
      ${formatDate('mbr.last_login')} AS derniere_connexion,
      res.active AS depot_active,
      CASE WHEN res.active THEN ${formatDate('res.activated_at')} END AS date_activation,
      coalesce(c.received, 0)::int AS nb_recues,
      ${formatDate('c.last_received')} AS derniere_reception,
      coalesce(c.treated, 0)::int AS nb_traitees,
      ${formatDate('c.last_status_change')} AS dernier_changement_statut,
      coalesce(c.pending, 0)::int AS nb_en_attente,
      coalesce(c.expired, 0)::int AS nb_expirees_non_traitees
    FROM residences res
    LEFT JOIN managers_by_residence mbr ON mbr.accommodation_id = res.id
    LEFT JOIN contacts c ON c.accommodation_id = res.id
    ORDER BY res.owner_name, res.name
  `)
}
