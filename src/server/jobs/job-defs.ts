import type { TImportJobType } from '~/schemas/import-jobs'
import { SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'

// Tâches qui journalisent encore dans `import_job` : sert de repli tant qu'aucune ligne `job_run` n'existe.
export const IMPORT_JOB_TYPE_BY_IDENTIFIER: Record<string, TImportJobType> = {
  'import-arpej-ibail': 'arpej-ibail',
  'import-fac-habitat': 'fac-habitat',
  'import-initiall': 'initiall',
  'sync-cities': 'sync-cities',
  'sync-rents': 'sync-rents',
  'sync-students': 'sync-students',
  'sync-stats': 'sync-stats',
  'detect-alert-jobs': 'alert-detection',
  'expire-alerts': 'alert-expiration',
  'check-applications-inactivity': 'applications-inactivity',
  'send-contact-digest': 'contact-digest',
  'send-goal-reminders': 'goal-reminders',
  'reset-stale-availability': 'availability-reset',
  'send-availability-recap': 'availability-recap',
  'capture-monthly-metrics': 'monthly-metrics',
  'purge-contact-requests': 'purge-contacts',
  'purge-logs': 'purge-logs',
  'backup-db': 'backup-db',
}

export const SCHEDULED_JOBS: { identifier: string; cron: string }[] = [...SCHEDULED_COMMANDS, ...SCHEDULED_IN_PROCESS].map(
  ({ identifier, cron }) => ({ identifier, cron }),
)
