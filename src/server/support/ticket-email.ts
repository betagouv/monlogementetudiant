import { type ESupportTicketCategory, SUPPORT_TICKET_CATEGORY_LABELS } from '~/enums/support-ticket'
import { sanitizeMailLine, sanitizeMailText } from '~/server/accommodations/report-email'

const formatTicketDate = (date: Date): string =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date)

interface SupportTicketEmailParams {
  category: ESupportTicketCategory
  message: string
  userName: string
  userEmail: string
  url: string
  date: Date
}

export const buildSupportTicketEmail = ({ category, message, userName, userEmail, url, date }: SupportTicketEmailParams) => {
  const categoryLabel = SUPPORT_TICKET_CATEGORY_LABELS[category]

  return {
    subject: `[Ticket support] ${categoryLabel}`,
    textContent: [
      'Un nouveau ticket de support a été ouvert sur Mon Logement Étudiant.',
      '',
      `Catégorie : ${categoryLabel}`,
      `Étudiant : ${sanitizeMailLine(userName)} (${sanitizeMailLine(userEmail)})`,
      `Date : ${formatTicketDate(date)}`,
      '',
      'Message :',
      sanitizeMailText(message),
      '',
      `Traiter le ticket : ${url}`,
    ].join('\n'),
  }
}
