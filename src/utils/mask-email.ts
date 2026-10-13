/**
 * Masque une adresse e-mail pour les logs : `jean.dupont@univ.fr` → `j***@univ.fr`.
 *
 * Les logs des crons (Scalingo) sortent du périmètre des durées de conservation RGPD : on y garde
 * de quoi recouper un incident (initiale + domaine) sans y écrire l'adresse complète.
 */
export const maskEmail = (email: string | null | undefined): string => {
  if (!email) return '(sans e-mail)'
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}
