import { IMPORT_JOB_TYPE_BY_IDENTIFIER } from '~/server/jobs/job-defs'

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
  'requeue-pending-alerts': {
    label: 'Reprise des alertes en attente',
    description: 'Remet en file les envois d’alertes étudiantes en attente depuis plus de 10 minutes',
  },
  'report-alert-failures': {
    label: 'Signalement des alertes en échec',
    description: 'Un mail récapitulatif des alertes étudiantes définitivement non envoyées après 3 tentatives',
  },
  'brevo-unblock-managers': {
    label: 'Déblocage Brevo des gestionnaires',
    description: 'Débloque dans Brevo les gestionnaires désabonnés des e-mails, qui ne pourraient plus recevoir leur lien de connexion',
  },
  'graphile-cleanup': {
    label: 'Nettoyage de la file des tâches',
    description: 'Supprime les tâches en échec définitif ainsi que les files et identifiants de tâches inutilisés',
  },
  'send-alert-batch': { label: 'Envoi des alertes', description: 'Un e-mail par alerte ou par groupe de favoris' },
  'detect-alerts': {
    label: 'Détection des hausses de disponibilité',
    description: 'Hausses de disponibilité des résidences modifiées → jobs d’alerte',
  },
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

export function getJobDef(identifier: string): TJobDef {
  return JOB_DEFS[identifier] ?? { label: identifier, description: '' }
}

// Libellés des détails `import_job` (clé = type d'import).
export const JOB_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(IMPORT_JOB_TYPE_BY_IDENTIFIER).map(([identifier, type]) => [type, getJobDef(identifier).label]),
)

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const PARIS_TIME_ZONE = 'Europe/Paris'

function parisOffsetHours(at: Date): number {
  const hourIn = (timeZone: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at))
  return (hourIn(PARIS_TIME_ZONE) - hourIn('UTC') + 24) % 24
}

export function formatParisDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

// Les crons sont en UTC ; le libellé est affiché en heure de Paris (décalage à la date `now`).
// Retourne l'expression brute si le motif n'est pas géré.
export function describeCron(cron: string, now: Date = new Date()): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [string, string, string, string, string]
  const isNumber = (value: string) => /^\d+$/.test(value)
  const offset = parisOffsetHours(now)
  const toParis = (utcHour: string) => Number(utcHour) + offset

  if (isNumber(minute) && isNumber(hour)) {
    const parisHour = toParis(hour)
    const time = `${parisHour % 24}h${minute.padStart(2, '0')}`
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') return `Tous les jours à ${time}`
    if (parisHour >= 24) return cron
    if (dayOfMonth === '*' && month === '*' && /^[0-6]$/.test(dayOfWeek)) return `Tous les ${WEEKDAYS[Number(dayOfWeek)]}s à ${time}`
    if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') return `Le 1er de chaque mois à ${time}`
    if (dayOfMonth === '1' && month === '*/3' && dayOfWeek === '*') return `Le 1er de chaque trimestre à ${time}`
  }

  const everyMinutes = minute.match(/^\*\/(\d+)$/)
  if (everyMinutes && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const step = `Toutes les ${everyMinutes[1]} min`
    if (hour === '*') return step
    const range = hour.match(/^(\d+)-(\d+)$/)
    if (range && toParis(range[2]!) + 1 <= 24) return `${step} de ${toParis(range[1]!)}h à ${toParis(range[2]!) + 1}h`
  }

  return cron
}
