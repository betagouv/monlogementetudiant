import { parseCrontab } from 'graphile-worker'
import { describe, expect, it } from 'vitest'
import { CRON_COMMANDS, jobNameFromArgv } from '../../../cli/cron-failure'
import { buildCrontab, SCHEDULED_COMMANDS, SCHEDULED_IN_PROCESS } from './schedule'

const EXPECTED: [string, string, string][] = [
  ['import-arpej-ibail', '0 2 * * *', 'import arpej-ibail --owner-slug arpej'],
  ['import-fac-habitat', '*/30 5-19 * * *', 'import fac-habitat --owner-slug fac-habitat'],
  ['sync-cities', '0 1 * * 0', 'sync cities'],
  ['sync-rents', '0 4 1 */3 *', 'sync rents'],
  ['sync-students', '10 4 1 * *', 'sync students'],
  ['purge-logs', '0 5 1 * *', 'purge-logs'],
  ['send-availability-recap', '0 5 1 * *', 'send-availability-recap'],
  ['sync-stats', '0 3 * * *', 'sync stats'],
  ['import-initiall', '0 4 * * *', 'import initiall --owner-slug initiall'],
  ['check-applications-inactivity', '0 6 * * *', 'check-applications-inactivity'],
  ['expire-alerts', '0 7 * * *', 'expire-alerts'],
  ['send-contact-digest', '0 7 * * *', 'send-contact-digest'],
  ['send-goal-reminders', '0 7 * * *', 'send-goal-reminders'],
  ['reset-stale-availability', '30 6 * * *', 'reset-stale-availability'],
  ['detect-alert-jobs', '0 8 * * *', 'detect-alert-jobs'],
  ['capture-monthly-metrics', '30 3 * * *', 'capture-monthly-metrics'],
  ['purge-contact-requests', '45 3 * * *', 'purge-contact-requests'],
  ['backup-db', '0 5 * * *', 'backup-db'],
]

describe('SCHEDULED_COMMANDS', () => {
  it('contient exactement les commandes attendues', () => {
    const actual = SCHEDULED_COMMANDS.map((c) => [c.identifier, c.cron, c.args.join(' ')])
    expect(actual).toHaveLength(EXPECTED.length)
    expect(actual).toEqual(expect.arrayContaining(EXPECTED))
  })

  it('a des identifiants uniques', () => {
    const ids = SCHEDULED_COMMANDS.map((c) => c.identifier)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ne planifie que des commandes notifiant leurs échecs', () => {
    for (const { args } of SCHEDULED_COMMANDS) {
      expect(CRON_COMMANDS.has(jobNameFromArgv(['node', 'cli/index.ts', ...args]))).toBe(true)
    }
  })
})

describe('SCHEDULED_IN_PROCESS', () => {
  it('planifie la reprise et le signalement des alertes', () => {
    expect(SCHEDULED_IN_PROCESS).toEqual([
      { identifier: 'requeue-pending-alerts', cron: '5 * * * *' },
      { identifier: 'report-alert-failures', cron: '15 * * * *' },
    ])
  })
})

describe('buildCrontab', () => {
  it('produit une ligne par entrée, parseable par graphile-worker', () => {
    const crontab = buildCrontab()
    expect(crontab.split('\n')).toHaveLength(SCHEDULED_COMMANDS.length + SCHEDULED_IN_PROCESS.length)

    const items = parseCrontab(crontab)
    expect(items.map((i) => i.identifier).sort()).toEqual([...SCHEDULED_COMMANDS, ...SCHEDULED_IN_PROCESS].map((c) => c.identifier).sort())
    for (const item of items.filter((i) => i.task === 'run-cli-command')) {
      expect(item.task).toBe('run-cli-command')
      expect(item.options).toMatchObject({ maxAttempts: 1, backfillPeriod: 0 })
      expect(item.options.queueName).toBe(item.identifier)
    }
    for (const { identifier } of SCHEDULED_IN_PROCESS) {
      const item = items.find((i) => i.identifier === identifier)
      expect(item?.task).toBe(identifier)
      expect(item?.options).toMatchObject({ maxAttempts: 1, backfillPeriod: 0, queueName: identifier })
    }
    expect(items.filter((i) => i.task === 'run-cli-command')).toHaveLength(SCHEDULED_COMMANDS.length)
    const arpej = items.find((i) => i.identifier === 'import-arpej-ibail')
    expect(arpej?.payload).toEqual({ args: ['import', 'arpej-ibail', '--owner-slug', 'arpej'] })
  })
})
