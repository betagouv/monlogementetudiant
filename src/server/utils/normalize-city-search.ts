/**
 * Normalize a city search query to match Django's normalize_city_search behavior.
 *
 * Steps:
 * 1. Replace ligatures (œ→oe, æ→ae)
 * 2. NFD + strip combining marks (accents)
 * 3. Lowercase
 * 4. Expand abbreviations: st/ste → saint
 * 5. Replace hyphens/underscores with spaces
 * 6. Collapse whitespace + trim
 */
export function normalizeCitySearch(q: string): string {
  let s = q
  s = s.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  s = s.toLowerCase()
  s = s.replace(/\bste\b/g, 'saint').replace(/\bst\b/g, 'saint')
  s = s.replace(/[-_]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Tokenize a normalized query string.
 * Splits on whitespace and filters out tokens shorter than 2 characters.
 */
export function tokenizeQuery(normalized: string): string[] {
  if (!normalized) return []
  return normalized.split(' ').filter((t) => t.length >= 2)
}
