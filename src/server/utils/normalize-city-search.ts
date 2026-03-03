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
  // 1. Ligatures
  s = s.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
  // 2. NFD + strip accents
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // 3. Lowercase
  s = s.toLowerCase()
  // 4. Expand st/ste abbreviations (word boundary)
  s = s.replace(/\bste\b/g, 'saint').replace(/\bst\b/g, 'saint')
  // 5. Hyphens/underscores → spaces
  s = s.replace(/[-_]/g, ' ')
  // 6. Collapse whitespace + trim
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
