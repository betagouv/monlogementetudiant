import { ACCOMMODATION_REPORT_FIELD_LABELS, type EAccommodationReportField } from '~/enums/accommodation-report-field'

const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+', 'g')
const CONTROL_CHARACTERS_EXCEPT_NEWLINE = new RegExp('[\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\\u2028\\u2029]+', 'g')

export const sanitizeMailLine = (value: string): string => value.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim()

export const sanitizeMailText = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARACTERS_EXCEPT_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const formatReportDate = (date: Date): string =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date)

interface AccommodationReportEmailParams {
  accommodationName: string
  ownerName: string | null
  field: EAccommodationReportField
  details?: string | null
  url: string
  date: Date
}

export const buildAccommodationReportEmail = ({
  accommodationName,
  ownerName,
  field,
  details,
  url,
  date,
}: AccommodationReportEmailParams) => {
  const name = sanitizeMailLine(accommodationName)
  const fieldLabel = ACCOMMODATION_REPORT_FIELD_LABELS[field]
  const sanitizedDetails = details ? sanitizeMailText(details) : ''

  return {
    subject: `[Signalement logement] ${name} – ${fieldLabel}`,
    textContent: [
      'Un utilisateur a signalé une information potentiellement incorrecte sur Mon Logement Étudiant.',
      '',
      `Logement : ${name}`,
      `Résidence : ${name}`,
      `Gestionnaire : ${ownerName ? sanitizeMailLine(ownerName) : 'Non renseigné'}`,
      `Information concernée : ${fieldLabel}`,
      `Précisions : ${sanitizedDetails || 'Non renseignées'}`,
      '',
      `URL du logement : ${url}`,
      `Date du signalement : ${formatReportDate(date)}`,
    ].join('\n'),
  }
}
