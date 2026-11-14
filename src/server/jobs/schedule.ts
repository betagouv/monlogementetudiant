import type { TJobIdentifier } from '~/server/jobs/enqueue'

export type TScheduledCommand = { identifier: string; cron: string; args: string[] }
export type TScheduledInProcess = { identifier: TJobIdentifier; cron: string }

export const SCHEDULED_COMMANDS: TScheduledCommand[] = [
  { identifier: 'import-arpej-ibail', cron: '0 2 * * *', args: ['import', 'arpej-ibail', '--owner-slug', 'arpej'] },
  { identifier: 'import-fac-habitat', cron: '*/30 5-19 * * *', args: ['import', 'fac-habitat', '--owner-slug', 'fac-habitat'] },
  { identifier: 'sync-cities', cron: '0 1 * * 0', args: ['sync', 'cities'] },
  { identifier: 'sync-rents', cron: '0 4 1 */3 *', args: ['sync', 'rents'] },
  { identifier: 'sync-students', cron: '10 4 1 * *', args: ['sync', 'students'] },
  { identifier: 'purge-logs', cron: '0 5 1 * *', args: ['purge-logs'] },
  { identifier: 'send-availability-recap', cron: '0 5 1 * *', args: ['send-availability-recap'] },
  { identifier: 'sync-stats', cron: '0 3 * * *', args: ['sync', 'stats'] },
  { identifier: 'import-initiall', cron: '0 4 * * *', args: ['import', 'initiall', '--owner-slug', 'initiall'] },
  { identifier: 'check-applications-inactivity', cron: '0 6 * * *', args: ['check-applications-inactivity'] },
  { identifier: 'expire-alerts', cron: '0 7 * * *', args: ['expire-alerts'] },
  { identifier: 'send-contact-digest', cron: '0 7 * * *', args: ['send-contact-digest'] },
  { identifier: 'send-goal-reminders', cron: '0 7 * * *', args: ['send-goal-reminders'] },
  { identifier: 'reset-stale-availability', cron: '30 6 * * *', args: ['reset-stale-availability'] },
  { identifier: 'send-alert-jobs', cron: '*/30 * * * *', args: ['send-alert-jobs'] },
  { identifier: 'detect-alert-jobs', cron: '0 8 * * *', args: ['detect-alert-jobs'] },
  { identifier: 'capture-monthly-metrics', cron: '30 3 * * *', args: ['capture-monthly-metrics'] },
  { identifier: 'purge-contact-requests', cron: '30 3 * * *', args: ['purge-contact-requests'] },
  { identifier: 'backup-db', cron: '0 5 * * *', args: ['backup-db'] },
]

export const SCHEDULED_IN_PROCESS: TScheduledInProcess[] = []

export function buildCrontab(): string {
  const commandLines = SCHEDULED_COMMANDS.map(({ identifier, cron, args }) => {
    const options = `id=${identifier}&max=1&queue=${identifier}`
    return `${cron} run-cli-command ?${options} ${JSON.stringify({ args })}`
  })
  const inProcessLines = SCHEDULED_IN_PROCESS.map(
    ({ identifier, cron }) => `${cron} ${identifier} ?id=${identifier}&max=1&queue=${identifier}`,
  )
  return [...commandLines, ...inProcessLines].join('\n')
}
