import { z } from 'zod'
import { ESupportTicketCategory } from '~/enums/support-ticket'

export const SUPPORT_TICKET_MESSAGE_MAX_LENGTH = 2000

export const ZSupportTicketCreate = z.object({
  category: z.enum(ESupportTicketCategory, { message: 'Veuillez sélectionner la partie du site concernée' }),
  message: z
    .string()
    .trim()
    .min(10, { message: 'Veuillez décrire le problème rencontré (10 caractères minimum)' })
    .max(SUPPORT_TICKET_MESSAGE_MAX_LENGTH, {
      message: `Votre message ne peut pas dépasser ${SUPPORT_TICKET_MESSAGE_MAX_LENGTH} caractères`,
    }),
})

export type TSupportTicketCreate = z.infer<typeof ZSupportTicketCreate>
