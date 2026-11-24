import { describe, expect, it } from 'vitest'
import { buildContactsExportHref, exportRegionOptions } from './contacts-export-options'

describe('buildContactsExportHref', () => {
  it('pointe vers l’export complet sans filtre', () => {
    expect(buildContactsExportHref({})).toBe('/api/bailleur/contacts/export')
  })

  it('ne transmet que les filtres renseignés', () => {
    expect(buildContactsExportHref({ ownerId: 3, region: 'Île-de-France', residence: '' })).toBe(
      '/api/bailleur/contacts/export?ownerId=3&region=%C3%8Ele-de-France',
    )
  })

  it('privilégie la résidence sur la région', () => {
    expect(buildContactsExportHref({ region: 'Bretagne', residence: 'res-a' })).toBe('/api/bailleur/contacts/export?residence=res-a')
  })
})

describe('exportRegionOptions', () => {
  it('liste les régions distinctes, triées, en ignorant les départements inconnus', () => {
    expect(
      exportRegionOptions([{ departmentCode: '69' }, { departmentCode: '75' }, { departmentCode: '01' }, { departmentCode: null }]),
    ).toEqual(['Auvergne-Rhône-Alpes', 'Île-de-France'])
  })
})
