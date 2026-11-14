import { describe, expect, it } from 'vitest'
import { SCHEDULED_COMMANDS } from '~/server/jobs/schedule'
import { describeCron, getJobDef } from './cron-job-defs'

const WINTER = new Date('2026-01-15T12:00:00Z')
const SUMMER = new Date('2026-07-15T12:00:00Z')

describe('describeCron (heure de Paris)', () => {
  it.each([
    ['0 2 * * *', 'Tous les jours à 3h00'],
    ['30 6 * * *', 'Tous les jours à 7h30'],
    ['0 1 * * 0', 'Tous les dimanches à 2h00'],
    ['10 4 1 * *', 'Le 1er de chaque mois à 5h10'],
    ['0 4 1 */3 *', 'Le 1er de chaque trimestre à 5h00'],
    ['*/30 5-19 * * *', 'Toutes les 30 min de 6h à 21h'],
    ['*/30 * * * *', 'Toutes les 30 min'],
    ['5 4 * * 1-5', '5 4 * * 1-5'],
  ])('hiver %s', (cron, expected) => {
    expect(describeCron(cron, WINTER)).toBe(expected)
  })

  it('applique le décalage d’été', () => {
    expect(describeCron('0 2 * * *', SUMMER)).toBe('Tous les jours à 4h00')
    expect(describeCron('*/30 5-19 * * *', SUMMER)).toBe('Toutes les 30 min de 7h à 22h')
  })
})

describe('getJobDef', () => {
  it('fournit un libellé pour chaque tâche planifiée', () => {
    for (const { identifier } of SCHEDULED_COMMANDS) expect(getJobDef(identifier).label).not.toBe(identifier)
  })
})
