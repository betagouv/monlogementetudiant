import { describe, expect, it } from 'vitest'
import { EAccommodationReportField } from '~/enums/accommodation-report-field'
import { buildAccommodationReportEmail, sanitizeMailLine, sanitizeMailText } from './report-email'

describe('sanitizeMailLine', () => {
  it('flattens line breaks and control characters', () => {
    expect(sanitizeMailLine('Résidence\r\nBcc: evil@example.com\u0000')).toBe('Résidence Bcc: evil@example.com')
  })
})

describe('sanitizeMailText', () => {
  it('keeps line breaks but removes other control characters', () => {
    expect(sanitizeMailText('ligne 1\r\nligne 2\u0007\n\n\n\nligne 3')).toBe('ligne 1\nligne 2\n\nligne 3')
  })
})

describe('buildAccommodationReportEmail', () => {
  const base = {
    accommodationName: 'Résidence Test',
    ownerName: 'Crous Créteil',
    field: EAccommodationReportField.AVAILABILITY,
    url: 'https://example.com/trouver-un-logement-etudiant/ville/paris/residence-test',
    date: new Date('2026-10-11T08:30:00Z'),
  }

  it('builds the subject and plain text body', () => {
    const { subject, textContent } = buildAccommodationReportEmail({ ...base, details: 'Plus aucune place' })

    expect(subject).toBe('[Signalement logement] Résidence Test – Disponibilité du logement')
    expect(textContent).toContain('Logement : Résidence Test')
    expect(textContent).toContain('Gestionnaire : Crous Créteil')
    expect(textContent).toContain('Précisions : Plus aucune place')
    expect(textContent).toContain(`URL du logement : ${base.url}`)
    expect(textContent).toContain('Date du signalement : 11/10/2026 10:30')
  })

  it('keeps user input inert in a single-line subject', () => {
    const { subject, textContent } = buildAccommodationReportEmail({
      ...base,
      accommodationName: 'Nom\nX-Injected: 1',
      details: '<script>alert(1)</script>',
    })

    expect(subject).not.toMatch(/[\r\n]/)
    expect(textContent).toContain('Précisions : <script>alert(1)</script>')
  })

  it('falls back when optional values are missing', () => {
    const { textContent } = buildAccommodationReportEmail({ ...base, ownerName: null, details: '   ' })

    expect(textContent).toContain('Gestionnaire : Non renseigné')
    expect(textContent).toContain('Précisions : Non renseignées')
  })
})
