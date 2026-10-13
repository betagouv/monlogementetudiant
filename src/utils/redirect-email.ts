// Hors production, les mails Brevo partent vers un domaine de test dont le MX pointe sur l'inbound
// Brevo, qui les relaie dans le Mailpit de la QA (repo mle-mailpit) : la QA voit les templates
// rendus sans qu'aucun mail n'atteigne un vrai utilisateur.
// `jean@gmail.com` → `jean.at.gmail.com@<domaine>` ; Mailpit restaure l'adresse d'origine.

const SEPARATOR = '.at.'
// RFC 5321 : un local-part ne dépasse pas 64 caractères, Brevo refuserait l'envoi.
const MAX_LOCAL_PART_LENGTH = 64
const FALLBACK_LOCAL_PART = 'adresse-trop-longue'

export const redirectEmail = (email: string, domain: string): string => {
  const at = email.lastIndexOf('@')
  const localPart = at === -1 ? email : `${email.slice(0, at)}${SEPARATOR}${email.slice(at + 1)}`
  return `${localPart.length > MAX_LOCAL_PART_LENGTH ? FALLBACK_LOCAL_PART : localPart}@${domain}`
}
