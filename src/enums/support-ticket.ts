import { z } from 'zod'

/** Partie de l'application concernée par un ticket de support étudiant. */
export enum ESupportTicketCategory {
  SEARCH = 'search',
  CONTACT_REQUEST = 'contact_request',
  STUDENT_SPACE = 'student_space',
  SIMULATORS = 'simulators',
  ACCOUNT = 'account',
  OTHER = 'other',
}

export const SUPPORT_TICKET_CATEGORIES = Object.values(ESupportTicketCategory)

export const ZSupportTicketCategory = z.enum(ESupportTicketCategory)

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<ESupportTicketCategory, string> = {
  [ESupportTicketCategory.SEARCH]: 'Recherche de logement',
  [ESupportTicketCategory.CONTACT_REQUEST]: 'Demande de contact',
  [ESupportTicketCategory.STUDENT_SPACE]: 'Mon espace étudiant',
  [ESupportTicketCategory.SIMULATORS]: 'Simulateurs',
  [ESupportTicketCategory.ACCOUNT]: 'Compte et connexion',
  [ESupportTicketCategory.OTHER]: 'Autre',
}

/** Cycle de vie d'un ticket, piloté depuis l'administration. */
export enum ESupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

export const SUPPORT_TICKET_STATUSES = Object.values(ESupportTicketStatus)

export const ZSupportTicketStatus = z.enum(ESupportTicketStatus)

export const SUPPORT_TICKET_STATUS_LABELS: Record<ESupportTicketStatus, string> = {
  [ESupportTicketStatus.OPEN]: 'Ouvert',
  [ESupportTicketStatus.IN_PROGRESS]: 'En cours',
  [ESupportTicketStatus.RESOLVED]: 'Résolu',
}
