import { describe, expect, it } from 'vitest'
import { backupKey, DAILY_PREFIX, dateFromKey, expiredDailyKeys, isKeeperDay, MONTHLY_PREFIX } from '../backup-storage'

const APP_NAME = 'mle-test-app-db'

/** Minuit UTC au jour donné — les clés sont datées en UTC, comme l'horloge des crons Scalingo. */
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('isKeeperDay', () => {
  it('conserve le 1er et le 15 du mois', () => {
    expect(isKeeperDay(utc('2026-08-01'))).toBe(true)
    expect(isKeeperDay(utc('2026-08-15'))).toBe(true)
  })

  it('ne conserve aucun autre jour, y compris les fins de mois', () => {
    for (const day of ['2026-08-02', '2026-08-14', '2026-08-16', '2026-08-31', '2026-02-28', '2028-02-29', '2026-04-30']) {
      expect(isKeeperDay(utc(day)), day).toBe(false)
    }
  })

  it("s'appuie sur la date UTC, pas sur le fuseau local", () => {
    // 23h00 UTC le 31/07 = 01h00 le 01/08 à Paris. C'est bien le 31 qui doit compter.
    expect(isKeeperDay(new Date('2026-07-31T23:00:00.000Z'))).toBe(false)
    expect(isKeeperDay(new Date('2026-08-01T23:00:00.000Z'))).toBe(true)
  })
})

describe('backupKey', () => {
  it('range les gardés sous monthly/ et les autres sous daily/', () => {
    expect(backupKey(APP_NAME, utc('2026-08-01'))).toBe(`${MONTHLY_PREFIX}${APP_NAME}-2026-08-01.tar.gz`)
    expect(backupKey(APP_NAME, utc('2026-08-15'))).toBe(`${MONTHLY_PREFIX}${APP_NAME}-2026-08-15.tar.gz`)
    expect(backupKey(APP_NAME, utc('2026-08-18'))).toBe(`${DAILY_PREFIX}${APP_NAME}-2026-08-18.tar.gz`)
  })

  it('date la clé en UTC quelle que soit l’heure du run', () => {
    expect(backupKey(APP_NAME, new Date('2026-08-18T23:30:00.000Z'))).toBe(`${DAILY_PREFIX}${APP_NAME}-2026-08-18.tar.gz`)
  })
})

describe('dateFromKey', () => {
  it('fait l’aller-retour avec backupKey', () => {
    for (const day of ['2026-08-01', '2026-08-15', '2026-08-18', '2028-02-29']) {
      expect(dateFromKey(backupKey(APP_NAME, utc(day)))?.toISOString(), day).toBe(`${day}T00:00:00.000Z`)
    }
  })

  it('rejette les clés étrangères au format', () => {
    for (const key of [
      `daily/${APP_NAME}.tar.gz`, // le format historique, sans date
      `daily/${APP_NAME}-2026-08-18.sql`,
      `weekly/${APP_NAME}-2026-08-18.tar.gz`,
      `${APP_NAME}-2026-08-18.tar.gz`, // à la racine, hors préfixe
      'daily/',
      '',
    ]) {
      expect(dateFromKey(key), key).toBeNull()
    }
  })

  it('rejette les dates impossibles plutôt que de les reporter au mois suivant', () => {
    expect(dateFromKey(`daily/${APP_NAME}-2026-02-31.tar.gz`)).toBeNull()
    expect(dateFromKey(`daily/${APP_NAME}-2026-02-29.tar.gz`)).toBeNull() // 2026 n'est pas bissextile
    expect(dateFromKey(`daily/${APP_NAME}-2026-13-01.tar.gz`)).toBeNull()
  })
})

describe('expiredDailyKeys', () => {
  const now = utc('2026-08-18')
  const daily = (day: string) => `${DAILY_PREFIX}${APP_NAME}-${day}.tar.gz`

  it('applique la borne exacte de 31 jours', () => {
    const justInside = daily('2026-07-18') // 31 jours pile : conservé
    const justOutside = daily('2026-07-17') // 32 jours : expiré

    expect(expiredDailyKeys([justInside, justOutside], now)).toEqual([justOutside])
  })

  it('conserve le backup du jour et les récents', () => {
    const keys = [daily('2026-08-18'), daily('2026-08-17'), daily('2026-07-20')]
    expect(expiredDailyKeys(keys, now)).toEqual([])
  })

  it('ignore les clés monthly/ même si on les lui passe', () => {
    const keys = [`${MONTHLY_PREFIX}${APP_NAME}-2024-01-01.tar.gz`, `${MONTHLY_PREFIX}${APP_NAME}-2023-06-15.tar.gz`]
    expect(expiredDailyKeys(keys, now)).toEqual([])
  })

  it('ignore les clés hors format plutôt que de les supprimer', () => {
    const keys = [`${DAILY_PREFIX}${APP_NAME}.tar.gz`, `${DAILY_PREFIX}notes.txt`, `${DAILY_PREFIX}${APP_NAME}-2020-01-01.sql`]
    expect(expiredDailyKeys(keys, now)).toEqual([])
  })

  it('ne renvoie que les expirés dans un lot mélangé', () => {
    const keys = [
      daily('2026-08-18'),
      daily('2026-06-01'),
      `${MONTHLY_PREFIX}${APP_NAME}-2026-06-01.tar.gz`,
      daily('2026-05-30'),
      `${DAILY_PREFIX}${APP_NAME}.tar.gz`,
    ]
    expect(expiredDailyKeys(keys, now)).toEqual([daily('2026-06-01'), daily('2026-05-30')])
  })

  it('ne supprime rien quand le bucket est vide', () => {
    expect(expiredDailyKeys([], now)).toEqual([])
  })
})
