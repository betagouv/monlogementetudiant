import DOMPurify from '~/utils/dompurify'
import { RICH_TEXT_ALLOWED_ATTR, RICH_TEXT_ALLOWED_TAGS } from '~/utils/sanitize-config'

/**
 * Sanitise du HTML riche (descriptions de résidences, etc.) avant injection.
 *
 * `isomorphic-dompurify` et non `dompurify` : les composants `'use client'` sont aussi rendus
 * côté serveur, et le `dompurify` nu n'expose pas `sanitize` hors navigateur (`isSupported: false`).
 * Il fournit un `window` jsdom côté serveur et se résout au `dompurify` nu côté navigateur (champ
 * `browser` du paquet) — jsdom ne part donc pas dans le bundle client.
 *
 * Sanitiser des deux côtés est indispensable : renvoyer le HTML brut au rendu serveur le laisse
 * atteindre le navigateur dans le HTML de la page, avant même que le client ne repasse dessus.
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
