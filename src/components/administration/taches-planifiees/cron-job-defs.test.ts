import { describe, expect, it } from 'vitest'
import { SCHEDULED_COMMANDS } from '~/server/jobs/schedule'
import { describeCron, getJobDef } from './cron-job-defs'

describe('describeCron', () => {
  it.each([
    ['0 2 * * *', 'Tous les jours à 2h00 UTC'],
    ['30 6 * * *', 'Tous les jours à 6h30 UTC'],
    ['0 1 * * 0', 'Tous les dimanches à 1h00 UTC'],
    ['10 4 1 * *', 'Le 1er de chaque mois à 4h10 UTC'],
    ['0 4 1 */3 *', 'Le 1er de chaque trimestre à 4h00 UTC'],
    ['*/30 5-19 * * *', 'Toutes les 30 min de 5h à 20h UTC'],
    ['*/30 * * * *', 'Toutes les 30 min'],
    ['5 4 * * 1-5', '5 4 * * 1-5'],
  ])('%s', (cron, expected) => {
    expect(describeCron(cron)).toBe(expected)
  })
})

describe('getJobDef', () => {
  it('fournit un libellé pour chaque tâche planifiée', () => {
    for (const { identifier } of SCHEDULED_COMMANDS) expect(getJobDef(identifier).label).not.toBe(identifier)
  })
})
