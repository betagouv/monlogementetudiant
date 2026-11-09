import { describe, expect, it } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { attributionOf } from '../attribution'

const contactedAt = new Date('2026-01-01')

describe('attributionOf', () => {
  it('logement attribué → oui', () => {
    expect(attributionOf({ status: EContactStatus.LOGEMENT_ATTRIBUE, contactedAt })).toBe('oui')
  })

  it('non retenu après contact → non', () => {
    expect(attributionOf({ status: EContactStatus.NON_RETENU, contactedAt })).toBe('non')
  })

  it("non retenu d'emblée → null", () => {
    expect(attributionOf({ status: EContactStatus.NON_RETENU, contactedAt: null })).toBeNull()
  })

  it('contacté → non renseigné', () => {
    expect(attributionOf({ status: EContactStatus.CONTACTE, contactedAt })).toBe('non_renseigne')
  })

  it('à contacter / à modérer → null', () => {
    expect(attributionOf({ status: EContactStatus.A_CONTACTER, contactedAt: null })).toBeNull()
    expect(attributionOf({ status: EContactStatus.A_MODERER, contactedAt: null })).toBeNull()
  })
})
