import { describe, expect, it } from 'vitest'
import { ACTION_COLORS, ACTION_ICONS, ACTION_LABELS } from './activity-actions'

describe('activity actions', () => {
  it('libelle l’export des coordonnées étudiantes pour le journal admin', () => {
    expect(ACTION_LABELS['contacts.exported']).toBe('Coordonnées étudiantes exportées')
    expect(ACTION_ICONS['contacts.exported']).toBe('fr-icon-download-line')
    expect(ACTION_COLORS['contacts.exported']).toBe('var(--background-flat-info)')
  })
})
