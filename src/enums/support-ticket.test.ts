import { describe, expect, it } from 'vitest'
import {
  ESupportTicketCategory,
  ESupportTicketStatus,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUSES,
} from './support-ticket'

describe('support ticket enums', () => {
  it('expose toutes les catégories', () => {
    expect(SUPPORT_TICKET_CATEGORIES).toEqual(Object.values(ESupportTicketCategory))
    expect(SUPPORT_TICKET_CATEGORIES).toHaveLength(6)
  })

  it('fournit un label non vide pour chaque catégorie', () => {
    for (const category of Object.values(ESupportTicketCategory)) {
      expect(SUPPORT_TICKET_CATEGORY_LABELS[category]).toBeTruthy()
    }
  })

  it('expose tous les statuts', () => {
    expect(SUPPORT_TICKET_STATUSES).toEqual(Object.values(ESupportTicketStatus))
    expect(SUPPORT_TICKET_STATUSES).toHaveLength(3)
  })

  it('fournit un label non vide pour chaque statut', () => {
    for (const status of Object.values(ESupportTicketStatus)) {
      expect(SUPPORT_TICKET_STATUS_LABELS[status]).toBeTruthy()
    }
  })

  it('n’a pas de doublon de libellé de catégorie', () => {
    const labels = Object.values(SUPPORT_TICKET_CATEGORY_LABELS)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
