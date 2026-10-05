import { describe, expect, it, vi } from 'vitest'
import { parseChangelogFile } from './read-entries'

const valid = `---
type: nouveaute
perimetre: parcours-contact
date: 2026-10-04
---
# Récap quotidien des contacts
Les gestionnaires reçoivent chaque matin la liste des nouveaux contacts.`

describe('parseChangelogFile', () => {
  it('parse une entrée valide complète', () => {
    const entry = parseChangelogFile(valid, '2026-10-04-digest.md')
    expect(entry).toEqual({
      slug: '2026-10-04-digest',
      type: 'nouveaute',
      perimetre: 'parcours-contact',
      date: '2026-10-04',
      title: 'Récap quotidien des contacts',
      description: 'Les gestionnaires reçoivent chaque matin la liste des nouveaux contacts.',
    })
  })

  it('accepte une entrée sans périmètre (champ optionnel)', () => {
    const raw = `---
type: correctif
date: 2026-09-30
---
# Correction d'affichage
Le badge ne clignotait plus.`
    const entry = parseChangelogFile(raw, 'fix.md')
    expect(entry?.perimetre).toBeUndefined()
    expect(entry?.type).toBe('correctif')
  })

  it('ignore une entrée au type invalide', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const raw = `---
type: inconnu
date: 2026-09-30
---
# Titre
Description.`
    expect(parseChangelogFile(raw, 'bad.md')).toBeNull()
  })

  it('ignore une entrée à la date malformée', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const raw = `---
type: nouveaute
date: 04/10/2026
---
# Titre
Description.`
    expect(parseChangelogFile(raw, 'bad-date.md')).toBeNull()
  })

  it('ignore une entrée sans corps (titre/description manquants)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const raw = `---
type: nouveaute
date: 2026-09-30
---`
    expect(parseChangelogFile(raw, 'empty.md')).toBeNull()
  })
})
