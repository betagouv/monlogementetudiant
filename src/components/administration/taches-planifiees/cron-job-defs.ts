import type { TImportJobType } from '~/schemas/import-jobs'
import { SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'

type TJobDef = { label: string; description: string }

const JOB_DEFS: Record<string, TJobDef> = {
  'import-arpej-ibail': { label: 'Import ARPEJ iBAIL', description: 'Résidences ARPEJ via API iBAIL' },
  'import-fac-habitat': { label: 'Import FAC Habitat', description: 'Résidences FAC Habitat via SFTP' },
  'import-initiall': { label: 'Import Initiall', description: 'Résidences Initiall via API WordPress' },
  'sync-cities': { label: 'Sync Villes', description: 'Communes depuis geo.api.gouv.fr' },
  'sync-rents': { label: 'Sync Loyers', description: 'Loyers moyens depuis data.gouv.fr' },
  'sync-students': { label: 'Sync Étudiants', description: 'Effectifs depuis data.enseignementsup' },
  'sync-stats': { label: 'Sync Statistiques', description: 'Statistiques Matomo' },
  'detect-alert-jobs': { label: 'Détection alertes', description: 'Hausses de disponibilité → jobs d’alerte' },
  'send-alert-jobs': { label: 'Envoi des alertes (ancien)', description: 'Envoi des alertes en attente aux étudiants' },
  'expire-alerts': {
    label: 'Péremption alertes',
    description: 'Relance à 3 mois (template 46) puis désactivation après 7 jours (template 48)',
  },
  'check-applications-inactivity': {
    label: 'Suivi des candidatures',
    description:
      'Alerte puis suspend les résidences inactives : candidatures non traitées (14 j), disponibilités non mises à jour (30 j), suspension 7 j après l’alerte sans action',
  },
  'send-contact-digest': {
    label: 'Récap demandes de contact',
    description: 'Récapitulatif quotidien des demandes de contact confirmées la veille, envoyé aux gestionnaires concernés',
  },
  'send-goal-reminders': {
    label: 'Rappels d’objectifs étudiants',
    description:
      'Rappel aux étudiants des objectifs personnalisés arrivés à échéance et non terminés (listes avec rappels activés, un seul rappel par objectif)',
  },
  'reset-stale-availability': {
    label: 'Péremption des disponibilités',
    description:
      'Disponibilités non mises à jour depuis 30 jours : alerte, puis « non communiquée » 7 j après sans action (hors bailleurs importés)',
  },
  'send-availability-recap': {
    label: 'Récap mensuel des disponibilités',
    description:
      'Rappel des disponibilités renseignées et de leur date de mise à jour, avec confirmation « Rien n’a changé » (hors bailleurs importés)',
  },
  'capture-monthly-metrics': {
    label: 'Relevé des métriques mensuelles',
    description: 'Candidatures recopiées sans donnée personnelle, compteurs du mois figés et états courants photographiés',
  },
  'purge-contact-requests': {
    label: 'Purge RGPD candidatures',
    description: 'Demandes non confirmées supprimées, expirées anonymisées',
  },
  'purge-logs': { label: 'Purge des logs', description: 'Tables append-only au-delà de leur rétention, archivées dans S3' },
  'backup-db': {
    label: 'Backup de la base',
    description: 'Backup Scalingo copié dans S3 — quotidiens gardés 31 jours, le 1er et le 15 indéfiniment',
  },
}

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

export function getJobDef(identifier: string): TJobDef {
  return JOB_DEFS[identifier] ?? { label: identifier, description: '' }
}

// Libellés des détails `import_job` (clé = type d'import).
export const JOB_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(IMPORT_JOB_TYPE_BY_IDENTIFIER).map(([identifier, type]) => [type, getJobDef(identifier).label]),
)

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function formatTime(hour: string, minute: string): string {
  return `${Number(hour)}h${minute.padStart(2, '0')}`
}

// Horaires en UTC. Retourne l'expression brute si le motif n'est pas géré.
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [string, string, string, string, string]
  const isNumber = (value: string) => /^\d+$/.test(value)

  if (isNumber(minute) && isNumber(hour)) {
    const time = `${formatTime(hour, minute)} UTC`
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') return `Tous les jours à ${time}`
    if (dayOfMonth === '*' && month === '*' && /^[0-6]$/.test(dayOfWeek)) return `Tous les ${WEEKDAYS[Number(dayOfWeek)]}s à ${time}`
    if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') return `Le 1er de chaque mois à ${time}`
    if (dayOfMonth === '1' && month === '*/3' && dayOfWeek === '*') return `Le 1er de chaque trimestre à ${time}`
  }

  const everyMinutes = minute.match(/^\*\/(\d+)$/)
  if (everyMinutes && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const step = `Toutes les ${everyMinutes[1]} min`
    if (hour === '*') return step
    const range = hour.match(/^(\d+)-(\d+)$/)
    if (range) return `${step} de ${Number(range[1])}h à ${Number(range[2]) + 1}h UTC`
  }

  return cron
}
