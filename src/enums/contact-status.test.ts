import { describe, expect, it } from 'vitest'
import {
  A_RAPPELER_STATUS,
  CONTACT_STATUS_CONFIG,
  CONTACT_STATUSES,
  CONTACTS_COLUMNS,
  columnsForMode,
  DF_COLUMNS,
  ZContactStatus,
} from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'

describe('contact statuses', () => {
  it('valide les 4 statuts', () => {
    expect(ZContactStatus.safeParse('a_moderer').success).toBe(true)
    expect(ZContactStatus.safeParse('a_contacter').success).toBe(true)
    expect(ZContactStatus.safeParse('contacte').success).toBe(true)
    expect(ZContactStatus.safeParse('non_retenu').success).toBe(true)
  })

  it('rejette un statut inconnu (ancien vocabulaire)', () => {
    expect(ZContactStatus.safeParse('pending').success).toBe(false)
    expect(ZContactStatus.safeParse('accepted').success).toBe(false)
  })

  it('a une config pour chaque statut', () => {
    for (const status of CONTACT_STATUSES) {
      expect(CONTACT_STATUS_CONFIG[status]).toBeDefined()
      expect(CONTACT_STATUS_CONFIG[status].barColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('« à rappeler » correspond au statut à contacter', () => {
    expect(A_RAPPELER_STATUS).toBe('a_contacter')
  })
})

describe('columnsForMode', () => {
  it('DossierFacile : 4 colonnes avec à modérer', () => {
    expect(columnsForMode(EOwnerContactMode.DOSSIER_FACILE)).toEqual(DF_COLUMNS)
    expect(DF_COLUMNS).toHaveLength(4)
    expect(DF_COLUMNS).toContain('a_moderer')
  })

  it('Contacts : 3 colonnes sans à modérer', () => {
    expect(columnsForMode(EOwnerContactMode.CONTACTS)).toEqual(CONTACTS_COLUMNS)
    expect(CONTACTS_COLUMNS).toHaveLength(3)
    expect(CONTACTS_COLUMNS).not.toContain('a_moderer')
  })

  it('les colonnes contacts sont incluses dans les colonnes DF', () => {
    for (const status of CONTACTS_COLUMNS) {
      expect(DF_COLUMNS).toContain(status)
    }
  })
})
