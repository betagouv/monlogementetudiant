import { type TImportJobType, ZImportJobType } from '~/schemas/import-jobs'

// Sous-ensemble des types cron (tout sauf 'csv' qui est un import manuel)
export const CRON_JOB_TYPES = ZImportJobType.options.filter((t) => t !== 'csv') as Exclude<TImportJobType, 'csv'>[]

export type CronJobType = (typeof CRON_JOB_TYPES)[number]

type CronJobDef = {
  type: CronJobType
  label: string
  description: string
  schedule: string
}

// Record exhaustif : TypeScript garantit que tous les types cron sont couverts
const CRON_JOB_DEF_MAP: Record<CronJobType, Omit<CronJobDef, 'type'>> = {
  'arpej-ibail': { label: 'Import ARPEJ iBAIL', description: 'Résidences ARPEJ via API iBAIL', schedule: 'Tous les jours à 2h00' },
  'fac-habitat': { label: 'Import FAC Habitat', description: 'Résidences FAC Habitat via SFTP', schedule: 'Tous les jours à 2h30' },
  initiall: { label: 'Import Initiall', description: 'Résidences Initiall via API WordPress', schedule: 'Tous les jours à 4h00' },
  'sync-cities': { label: 'Sync Villes', description: 'Communes depuis geo.api.gouv.fr', schedule: 'Tous les dimanches à 1h00' },
  'sync-rents': { label: 'Sync Loyers', description: 'Loyers moyens depuis data.gouv.fr', schedule: 'Le 1er de chaque trimestre à 4h00' },
  'sync-students': {
    label: 'Sync Étudiants',
    description: 'Effectifs depuis data.enseignementsup',
    schedule: 'Le 1er de chaque mois à 4h10',
  },
  'sync-stats': { label: 'Sync Statistiques', description: 'Statistiques Matomo', schedule: 'Tous les jours à 3h00' },
  'alert-detection': {
    label: 'Détection alertes',
    description: 'Hausses de disponibilité → jobs d’alerte',
    schedule: 'Tous les jours à 9h00 et 17h00',
  },
  'alert-expiration': {
    label: 'Péremption alertes',
    description: 'Relance à 3 mois (template 46) puis désactivation après 7 jours (template 48)',
    schedule: 'Tous les jours à 8h00',
  },
  'applications-inactivity': {
    label: 'Suivi des candidatures',
    description:
      'Alerte puis suspend les résidences inactives : candidatures non traitées (7 j / 10 j), disponibilités non mises à jour (23 j / 30 j)',
    schedule: 'Tous les jours à 7h00',
  },
  'purge-contacts': {
    label: 'Purge RGPD candidatures',
    description: 'Demandes non confirmées supprimées, expirées anonymisées',
    schedule: 'Tous les jours à 3h30',
  },
  'purge-logs': {
    label: 'Purge des logs',
    description: 'Tables append-only au-delà de leur rétention, archivées dans S3',
    schedule: 'Le 1er de chaque mois à 5h00',
  },
  'backup-db': {
    label: 'Backup de la base',
    description: 'Backup Scalingo copié dans S3 — quotidiens gardés 31 jours, le 1er et le 15 indéfiniment',
    schedule: 'Tous les jours à 5h00',
  },
}

export const CRON_JOB_DEFS: CronJobDef[] = CRON_JOB_TYPES.map((type) => ({ type, ...CRON_JOB_DEF_MAP[type] }))

export const JOB_LABELS: Record<CronJobType, string> = Object.fromEntries(
  CRON_JOB_TYPES.map((type) => [type, CRON_JOB_DEF_MAP[type].label]),
) as Record<CronJobType, string>
