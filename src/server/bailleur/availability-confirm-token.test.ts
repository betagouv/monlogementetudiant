import { describe, expect, it } from 'vitest'
import { DAY_MS } from '~/utils/time'
import { createAvailabilityConfirmToken, verifyAvailabilityConfirmToken } from './availability-confirm-token'

const issuedAt = new Date('2026-11-01T05:00:00Z')
const grant = { userId: 'user-1', ownerId: 42, onlyWarned: false }
const token = createAvailabilityConfirmToken(grant, issuedAt)

describe('jeton « Rien n’a changé »', () => {
  it('restitue le destinataire et la date d’envoi', () => {
    expect(verifyAvailabilityConfirmToken(token, new Date(issuedAt.getTime() + DAY_MS))).toEqual({
      ok: true,
      grant: { ...grant, issuedAt },
    })
  })

  it('expire après 35 jours', () => {
    expect(verifyAvailabilityConfirmToken(token, new Date(issuedAt.getTime() + 35 * DAY_MS + 1))).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuse une charge modifiée, même bien formée', () => {
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...grant, ownerId: 1, purpose: 'availability-confirm', iat: 0, exp: Infinity })).toString(
      'base64url',
    )
    expect(verifyAvailabilityConfirmToken(`${forged}.${signature}`, issuedAt)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuse les jetons mal formés', () => {
    for (const value of ['', 'abc', `${token}.extra`, `${token.split('.')[0]}.`]) {
      expect(verifyAvailabilityConfirmToken(value, issuedAt)).toEqual({ ok: false, reason: 'invalid' })
    }
  })
})
