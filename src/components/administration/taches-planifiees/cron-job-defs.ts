import { type TImportJobType, ZImportJobType } from '~/schemas/import-jobs'

// Sous-ensemble des types cron (tout sauf 'csv' qui est un import manuel)
export const CRON_JOB_TYPES = ZImportJobType.options.filter((t) => t !== 'csv') as Exclude<TImportJobType, 'csv'>[]

export type CronJobType = (typeof CRON_JOB_TYPES)[number]

// Helper : tout ce qui ne contient pas "sync" est un import
export function isImportJob(type: string): boolean {
  return !type.includes('sync')
}

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
}

export const CRON_JOB_DEFS: CronJobDef[] = CRON_JOB_TYPES.map((type) => ({ type, ...CRON_JOB_DEF_MAP[type] }))

export const JOB_LABELS: Record<CronJobType, string> = Object.fromEntries(
  CRON_JOB_TYPES.map((type) => [type, CRON_JOB_DEF_MAP[type].label]),
) as Record<CronJobType, string>
