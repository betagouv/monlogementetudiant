export const FRENCH_PHONE_NUMBER_REGEX = /^0[1-9]\d{8}$/

export const normalizeFrenchPhoneNumber = (raw: string): string => {
  const compact = raw.replace(/\(0\)/g, '').replace(/[\s.\-()]/g, '')
  if (compact.startsWith('+33')) return `0${compact.slice(3)}`
  if (compact.startsWith('0033')) return `0${compact.slice(4)}`
  return compact
}

export const formatFrenchPhoneNumber = (phoneNumber: string): string => {
  const normalized = normalizeFrenchPhoneNumber(phoneNumber)
  if (!FRENCH_PHONE_NUMBER_REGEX.test(normalized)) return phoneNumber
  return normalized.replace(/(\d{2})(?=\d)/g, '$1 ')
}

export const toTelHref = (phoneNumber: string): string => `tel:+33${normalizeFrenchPhoneNumber(phoneNumber).slice(1)}`
