import { env } from '~/server/env'
import { sendRawEmail } from '~/server/services/brevo'

/**
 * Commandes exécutées par un planificateur (`cron.json`) : ce sont les seules dont l'échec
 * déclenche un mail, un one-off lancé à la main affichant déjà son erreur dans le terminal.
 *
 * Cette liste doit rester synchronisée avec `cron.json` — `cron-failure.test.ts` échoue si
 * une commande planifiée n'y figure pas. L'inverse est autorisé : `cron-selftest` est traitée
 * comme un cron pour pouvoir valider la chaîne d'alerte, sans être planifiée.
 */
export const CRON_COMMANDS = new Set([
  'import arpej-ibail',
  'import fac-habitat',
  'import initiall',
  'sync cities',
  'sync rents',
  'sync students',
  'sync stats',
  'send-alert-jobs',
  'detect-alert-jobs',
  'expire-alerts',
  'check-applications-inactivity',
  'purge-contact-requests',
  'purge-logs',
  'backup-db',
  'cron-selftest',
])

/** Nombre de lignes de stack conservées dans le mail — le reste est dans les logs Scalingo. */
const STACK_LINES = 15
/** Nombre d'erreurs unitaires détaillées pour un échec partiel — le reste est compté. */
const PARTIAL_ERRORS_SHOWN = 10

/**
 * Échec partiel : la commande est allée au bout et a écrit son `import_job`, mais une partie
 * du traitement a échoué (résidences non importées, alertes définitivement non envoyées).
 * Levée en toute fin de commande pour que l'alerte et le code de sortie disent la vérité.
 */
export class CronPartialFailure extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'CronPartialFailure'
    this.details = details
  }
}

/**
 * Reconstitue le nom du job depuis la ligne de commande : on prend les arguments jusqu'à la
 * première option, pour que `sync stats --only events` donne bien `sync stats`.
 */
export function jobNameFromArgv(argv: string[]): string {
  const parts: string[] = []
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('-')) break
    parts.push(arg)
  }
  return parts.join(' ')
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Paris',
  }).format(date)
}

function formatStack(error: unknown): string {
  if (!(error instanceof Error) || !error.stack) return ''
  // La première ligne de la stack répète le message, déjà affiché juste au-dessus.
  const lines = error.stack.split('\n').slice(1)
  const shown = lines.slice(0, STACK_LINES)
  const hidden = lines.length - shown.length
  return [...shown, ...(hidden > 0 ? [`  … ${hidden} ligne(s) supplémentaire(s)`] : [])].join('\n')
}

function formatPartialErrors(error: unknown): string {
  if (!(error instanceof CronPartialFailure) || error.details.length === 0) return ''
  const shown = error.details.slice(0, PARTIAL_ERRORS_SHOWN)
  const hidden = error.details.length - shown.length
  return [
    '',
    `Détail (${error.details.length}) :`,
    ...shown.map((detail) => `  - ${detail}`),
    ...(hidden > 0 ? [`  … ${hidden} autre(s), voir les logs et l'admin « Tâches planifiées »`] : []),
  ].join('\n')
}

interface CronFailure {
  job: string
  error: unknown
  startedAt: Date
  endedAt?: Date
}

export function formatCronFailure({ job, error, startedAt, endedAt = new Date() }: CronFailure): {
  subject: string
  textContent: string
} {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const stack = formatStack(error)

  const textContent = [
    `Job        : ${job}`,
    `Env        : ${env.NEXT_PUBLIC_APP_ENV}`,
    `Début      : ${formatDate(startedAt)} (Europe/Paris)`,
    `Durée      : ${formatDuration(endedAt.getTime() - startedAt.getTime())}`,
    `Conteneur  : ${process.env.CONTAINER ?? 'inconnu'}`,
    '',
    `Erreur : ${message}`,
    ...(stack ? ['', stack] : []),
    formatPartialErrors(error),
  ]
    .join('\n')
    .trimEnd()

  return {
    subject: `[MLE ${env.NEXT_PUBLIC_APP_ENV}] Cron en échec — ${job}`,
    textContent,
  }
}

/**
 * Prévient par mail qu'un job planifié a échoué. Ne relance jamais : un souci d'envoi ne doit
 * ni masquer l'erreur d'origine ni changer le code de sortie du job.
 */
export async function notifyCronFailure(failure: CronFailure): Promise<void> {
  const recipients = env.CRON_FAILURE_EMAILS
  if (recipients.length === 0) {
    console.error('⚠️ CRON_FAILURE_EMAILS non renseignée : aucune alerte mail envoyée pour cet échec.')
    return
  }

  const { subject, textContent } = formatCronFailure(failure)

  try {
    await sendRawEmail({ to: recipients, subject, textContent })
    console.error(`✉️ Alerte d'échec envoyée à ${recipients.join(', ')}`)
  } catch (error) {
    console.error("⚠️ Envoi de l'alerte d'échec impossible :", error instanceof Error ? error.message : String(error))
  }
}
