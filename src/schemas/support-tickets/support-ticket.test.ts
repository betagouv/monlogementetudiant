import { describe, expect, it } from 'vitest'
import { ESupportTicketCategory } from '~/enums/support-ticket'
import { SUPPORT_TICKET_MESSAGE_MAX_LENGTH, ZSupportTicketCreate } from './support-ticket'

const validInput = { category: ESupportTicketCategory.SEARCH, message: 'La carte ne se charge pas' }

describe('ZSupportTicketCreate', () => {
  it('accepte une entrée valide', () => {
    const result = ZSupportTicketCreate.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejette un message trop court (< 10 caractères)', () => {
    const result = ZSupportTicketCreate.safeParse({ ...validInput, message: 'court' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Veuillez décrire le problème rencontré (10 caractères minimum)')
    }
  })

  it('rejette un message vide', () => {
    expect(ZSupportTicketCreate.safeParse({ ...validInput, message: '' }).success).toBe(false)
  })

  it('compte la longueur après trim (espaces seuls insuffisants)', () => {
    expect(ZSupportTicketCreate.safeParse({ ...validInput, message: '          ' }).success).toBe(false)
  })

  it('nettoie les espaces en bordure du message', () => {
    const result = ZSupportTicketCreate.safeParse({ ...validInput, message: '  Un message valide  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.message).toBe('Un message valide')
  })

  it('rejette un message au-delà de la limite max', () => {
    const result = ZSupportTicketCreate.safeParse({ ...validInput, message: 'a'.repeat(SUPPORT_TICKET_MESSAGE_MAX_LENGTH + 1) })
    expect(result.success).toBe(false)
  })

  it('accepte un message exactement à la limite max', () => {
    const result = ZSupportTicketCreate.safeParse({ ...validInput, message: 'a'.repeat(SUPPORT_TICKET_MESSAGE_MAX_LENGTH) })
    expect(result.success).toBe(true)
  })

  it('rejette une catégorie inconnue', () => {
    const result = ZSupportTicketCreate.safeParse({ category: 'inconnue', message: validInput.message })
    expect(result.success).toBe(false)
  })

  it('rejette une catégorie manquante avec un message FR', () => {
    const result = ZSupportTicketCreate.safeParse({ message: validInput.message })
    expect(result.success).toBe(false)
    if (!result.success) {
      const categoryIssue = result.error.issues.find((issue) => issue.path[0] === 'category')
      expect(categoryIssue?.message).toBe('Veuillez sélectionner la partie du site concernée')
    }
  })

  it('accepte chaque catégorie valide', () => {
    for (const category of Object.values(ESupportTicketCategory)) {
      expect(ZSupportTicketCreate.safeParse({ category, message: validInput.message }).success).toBe(true)
    }
  })
})
