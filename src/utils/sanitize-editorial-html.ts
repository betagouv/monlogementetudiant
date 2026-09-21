import DOMPurify from '~/utils/dompurify'

/**
 * Balises autorisées dans un contenu éditorial saisi hors du code (base de données, CMS).
 *
 * Les titres `h1`–`h6` en sont volontairement absents : un titre injecté s'insérerait dans le
 * plan de la page et le désorganiserait (RGAA 9.1). Le plan reste ainsi déterminé par le code.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'div',
  'blockquote',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'caption',
]

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'lang', 'class', 'scope', 'colspan', 'rowspan']

/**
 * Sanitise un contenu HTML éditorial avant injection via dangerouslySetInnerHTML.
 * À appeler le plus tôt possible — au chargement de la donnée, pas au rendu.
 */
export function sanitizeEditorialHTML(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false })
}
