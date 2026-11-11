import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { ZMonthRange } from '~/schemas/admin-metrics/month-range'
import { defaultMonthRange, listMonths, monthOf, monthStart, share } from './months'

describe('listMonths', () => {
  it('liste les mois bornes incluses', () => {
    expect(listMonths({ from: '2025-11', to: '2026-02' })).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('monthStart', () => {
  it('retourne le 1er du mois a minuit Paris en UTC', () => {
    expect(monthStart('2026-11').toISOString()).toBe('2026-10-31T23:00:00.000Z')
  })
})

describe('monthOf', () => {
  it('genere une expression en heure de Paris', () => {
    const { sql: query } = new PgDialect().sqlToQuery(monthOf(sql`created_at`))
    expect(query).toContain('Europe/Paris')
    expect(query).toContain('YYYY-MM')
  })
})

describe('share', () => {
  it('gere les totaux nuls', () => {
    expect(share(1, 0)).toBeNull()
    expect(share(1, 4)).toBe(0.25)
    expect(share(null, 4)).toBeNull()
    expect(share(1, null)).toBeNull()
  })
})

describe('ZMonthRange', () => {
  it('rejette from > to', () => {
    const result = ZMonthRange.safeParse({ from: '2026-05', to: '2026-01' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('La date de début doit précéder la date de fin')
  })
  it('rejette plus de 24 mois', () => {
    const result = ZMonthRange.safeParse({ from: '2024-01', to: '2026-01' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('La période ne peut pas dépasser 24 mois')
  })
  it('accepte 24 mois', () => {
    expect(ZMonthRange.safeParse({ from: '2024-02', to: '2026-01' }).success).toBe(true)
  })
  it('rejette un mois invalide', () => {
    const result = ZMonthRange.safeParse({ from: '2026-13', to: '2026-14' })
    expect(result.error?.issues[0]?.message).toBe('Mois invalide')
  })
})

describe('defaultMonthRange', () => {
  it('couvre les 12 derniers mois', () => {
    expect(defaultMonthRange(new Date('2026-11-11'))).toEqual({ from: '2025-12', to: '2026-11' })
  })
})
