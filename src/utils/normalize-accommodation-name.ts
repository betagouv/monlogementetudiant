/**
 * Normalise le nom d'une accommodation :
 *
 *  - Title case systématique : première lettre de chaque mot en majuscule,
 *    reste en minuscules (quelle que soit la casse d'entrée).
 *  - Mots-outils français (`des, de, du, en, les, la, le, aux, sur, et, pour`)
 *    remis en minuscules quand ils apparaissent comme mots entiers.
 *  - Élisions `L'` et `D'` (apostrophe droite ou typographique) en début ou
 *    après une espace remises en minuscules.
 *  - Espaces multiples compactés.
 *  - Si le nom commence par « Résidence[s] » (accent optionnel, `s` optionnel,
 *    insensible à la casse) suivi d'une espace, le préfixe est retiré puis
 *    réintroduit au singulier seulement si le corps d'origine commence par un
 *    article (`le, la, les, du, de, des, en, l' suivi d'espace/fin,
 *    d' suivi d'espace/fin`). Sinon, « Résidence » est définitivement supprimé.
 */

const RESIDENCE_PREFIX = /^r[eé]sidences?\s+/i

const KEEP_RESIDENCE_ARTICLE = /^(le|la|les|du|de|des|en|l['’]|d['’])(\s|$)/i

const LOWERCASE_WORDS = ['des', 'de', 'du', 'en', 'les', 'la', 'le', 'aux', 'sur', 'et', 'pour'] as const

const APOSTROPHES = "['’]"

function initcap(input: string): string {
  return input.toLowerCase().replace(/[\p{L}\p{N}]+/gu, (word) => {
    const [first, ...rest] = [...word]
    return first.toUpperCase() + rest.join('')
  })
}

function lowercaseWord(text: string, word: string): string {
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1)
  const pattern = new RegExp(`(^|\\s)${capitalized}(\\s|$)`, 'g')
  return text.replace(pattern, `$1${word}$2`)
}

function prettify(body: string): string {
  let pretty = initcap(body)

  for (const word of LOWERCASE_WORDS) {
    pretty = lowercaseWord(pretty, word)
  }

  pretty = pretty.replace(new RegExp(`(^|\\s)L(${APOSTROPHES})`, 'g'), '$1l$2')
  pretty = pretty.replace(new RegExp(`(^|\\s)D(${APOSTROPHES})`, 'g'), '$1d$2')

  return pretty.replace(/\s+/g, ' ').trim()
}

export function normalizeAccommodationName(name: string | null | undefined): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''

  if (RESIDENCE_PREFIX.test(trimmed)) {
    const body = trimmed.replace(RESIDENCE_PREFIX, '')
    const keepResidence = KEEP_RESIDENCE_ARTICLE.test(body)
    const pretty = prettify(body)
    return keepResidence ? `Résidence ${pretty}` : pretty
  }

  return prettify(trimmed)
}
