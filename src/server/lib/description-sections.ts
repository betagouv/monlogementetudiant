import DOMPurify from 'isomorphic-dompurify'
import { sanitizeHTML } from '~/utils/sanitize-html'

export type TDescriptionSections = {
  tagline: string | null
  locationAndProximity: string | null
  servicesAndEquipment: string | null
  receptionAndContact: string | null
  practicalInfo: string | null
  otherInformation: string | null
}

type TTopic = 'practicalInfo' | 'receptionAndContact' | 'servicesAndEquipment' | 'locationAndProximity'
type TSection = TTopic | 'otherInformation'

// L'ordre départage les égalités de score : les rubriques les plus spécifiques passent devant.
const TOPICS: TTopic[] = ['practicalInfo', 'receptionAndContact', 'servicesAndEquipment', 'locationAndProximity']
const SECTIONS: TSection[] = [...TOPICS, 'otherInformation']

type TRule = [RegExp, number]

const RULES: Record<TTopic, TRule[]> = {
  locationAndProximity: [
    [/\b(proximite|a deux pas|non loin|pres d[eu']|proches? d[eu']|au coeur d|aux portes d|en plein (centre|coeur))/g, 2],
    [/\ba (seulement |environ |moins de |peine )?(\d+|quelques|cinq|dix|quinze|vingt) ?(min|minutes|mn|km|m(?![²2])|metres)\b/g, 2],
    [/\b(transports?|mobilites?|deplacements?|trajets?)\b/g, 1],
    [/\b(environnement|nature|vie urbaine|alentours|loisirs|sante|cabinet medical|medecins?|tennis)\b/g, 1],
    [/\b(a pied|en velo|en voiture|en bus|en tram|en metro|en transports?)\b/g, 2],
    [
      /\b(desservie?s?|transports? en commun|stations?|metro|tram(way)?|bus|rer|ter|gare( routiere)?|arrets?|lignes? [a-z0-9]{1,3}|v'lille|velib|velo'v)\b/g,
      2,
    ],
    [/\b(situee?s?|se situe|se trouve|implantee?s?|emplacement|localisation|quartiers?|arrondissement|centre-?ville|centre ville)\b/g, 2],
    [/\b\d+ ?(bis|ter)?,? (rue|avenue|av|boulevard|bd|place|allee|chemin|impasse|quai|cours|route)\b/g, 2],
    [
      /\b(campus|universit\w*|facultes?|fac|iut|ecoles?|lycees?|ifsi|insa|chu|hopita\w*|commerces?|supermarches?|marche|boulangeries?|pharmacies?|banques?|la poste|restaurants?|restos?|bars?|cafes?|cinemas?|piscines?|stades?|parcs?|plages?|musees?|centre commercial|zoo|berges|bibliotheques?|bu|ru)\b/g,
      1,
    ],
  ],
  servicesAndEquipment: [
    [
      /\b(laverie|buanderie|local (a |aux )?(velos?|2 roues|deux roues|poussettes)|parkings?|garages?|wi-?fi|internet|fibre|coworking|rooftop|terrasses?|ascenseurs?|digicode|interphone|badge|videosurveillance|video-?protection|vigik)\b/g,
      2,
    ],
    [
      /\b(salles? (de sport|de fitness|de musculation|communes?|d'etudes?|de travail|informatique|de remise en forme|polyvalente|de convivialite|tv|de jeux|de reunion)|espaces? (communs?|partages?|detente|multimedia|informatique|de travail|de vie|convivia\w*)|cuisines? (collectives?|communes?|partagees?|equipees?)|salon collectif)\b/g,
      2,
    ],
    [
      /\b(kitchenettes?|refrigerateurs?|frigos?|micro-?ondes?|plaques?|four|lave-?(vaisselle|linge)|machines? a laver|lits?|matelas|bureau|chaises?|armoires?|placards?|rangements?|penderie|salles? d'eau|salles? de bains?|douches?|wc|toilettes|sanitaires|coin (cuisine|nuit))\b/g,
      2,
    ],
    [
      /\b(meublee?s?|equipee?s?|amenagee?s?|mobilier|television|tv|pmr|mobilite reduite|handicap|accessibles?|securisee?s?|jardins?|balcons?|animations?|activites|evenements)\b/g,
      1,
    ],
  ],
  receptionAndContact: [
    [
      /\b(accueil|gardiens?|gardiennage|concierg\w*|regisseurs?|responsables? de (site|residence|secteur|la residence)|gestionnaires? (de (la )?residence|sur place)|intendant|agents? d'accueil|permanences?|astreinte|interlocuteur|referent)\b/g,
      2,
    ],
    [/\b(horaires?|du lundi au \w+|sur rendez-vous|rendez-vous|rdv)\b/g, 2],
    [/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/g, 1],
    [/\b\d{1,2} ?h ?\d{0,2} ?(a|-|et) ?\d{1,2} ?h/g, 2],
    [
      /\b(contacte[rz]?|joindre|joignable|telephone|tel|appel(er|ez)|e-?mail|mail|courriel|formulaire|site internet|www|renseignements?|agence)\b|[\w.-]+@[\w-]+\.\w+|\b0\d([ .]?\d{2}){4}\b/g,
      2,
    ],
    [/\b(equipe|accompagn\w*|a votre ecoute)\b/g, 1],
  ],
  practicalInfo: [
    [
      /\b(loyers?|charges?(?! d'(entretien|accueil|mission|clientele))|euros?|montants?|tarifs?|prix|demarches|apl|als|caf|aides? au logement|allocations? (de )?logement|conventionnee?s?|depot de garantie|caution|garants?|visale|frais (de dossier|d'agence)|bail|preavis|etat des lieux|assurance|redevance|prestations? (obligatoires?|mensuelles?)|cotisation|adhesion|regularisation|terme echu|a echoir)\b/g,
      2,
    ],
    [/€/g, 2],
    [
      /\b(par mois|mensuel\w*|duree (de (sejour|location)|minimale|maximale|du sejour|du bail)|sejour (minimum|maximum)|mois minimum|(minimum|maximum) (de )?\d+ (mois|ans?)|disponible (a partir|des)|date d'entree|entree dans les lieux)\b/g,
      2,
    ],
    [
      /\b(dossiers?|candidatures?|postuler|inscriptions?|admission|reserv(e|ee|es|ees) (aux|a)|eligibles?|eligibilite|conditions?|criteres|demandes? de logements?|moins de \d+ ans|\d+ ?(a|-|\/) ?\d+ ans|boursiers?|priorit\w*|animaux|non[- ]fumeur|fumer|interdit)\b/g,
      2,
    ],
    [
      /\b(electricite|chauffage|alternants?|apprentis?|jeunes actifs|jeunes travailleurs|stagiaires?|contrat de professionnalisation|premier emploi|mobilite professionnelle)\b/g,
      1,
    ],
  ],
}

const PITCH =
  /\b(bienvenue|decouvre[zr]?|ideal\w*|promesse|cadre de vie|bonnes raisons|vous accueille|t'accueille|vivre une experience)\b|!/

const TAGLINE_MAX_LENGTH = 220
const HEADING_MAX_LENGTH = 150
const PLAIN_HEADING_MAX_LENGTH = 70
const HEADING_CONTEXT_BONUS = 2
const LIST_CONTEXT_BONUS = 1

type TScores = Record<TTopic, number>

type TLine = { kind: 'heading' | 'item' | 'para'; html: string; text: string; blankBefore: boolean }

type TBlock = { type: 'heading'; line: TLine } | { type: 'paragraph'; line: TLine } | { type: 'list'; intro: TLine | null; items: TLine[] }

const ITEM_MARKER = /^\s*(?:[-–—•*▪●◦·✓✔→»>]|o(?=\s)|\d{1,2}[.)](?=\s))\s*/
const ITEM_MARKER_HTML = /^((?:<[^>]+>)*)\s*(?:[-–—•*▪●◦·✓✔→»]|&gt;|o(?=\s)|\d{1,2}[.)](?=\s))\s*/

const NBSP = new RegExp('\\u00a0', 'g')

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE'])
const INLINE_TAGS: Record<string, string> = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u' }

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’`]/g, "'")
}

function looksLikeHtml(raw: string): boolean {
  return /<\/?(p|div|br|ul|ol|li|h[1-6]|strong|b|em|span)\b/i.test(raw)
}

function plainTextToHtml(raw: string): string {
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => `<p>${paragraph.replace(/</g, '&lt;').replace(/>/g, '&gt;').split(/\r?\n/).join('<br>')}</p>`)
    .join('')
}

function extractLines(raw: string): TLine[] {
  const fragment = DOMPurify.sanitize(looksLikeHtml(raw) ? raw : plainTextToHtml(raw), {
    ALLOWED_TAGS: [
      ...Object.keys(INLINE_TAGS).map((t) => t.toLowerCase()),
      ...[...BLOCK_TAGS].map((t) => t.toLowerCase()),
      'br',
      'a',
      'span',
    ],
    ALLOWED_ATTR: ['href'],
    RETURN_DOM_FRAGMENT: true,
  })

  const lines: TLine[] = []
  let html = ''
  let kind: TLine['kind'] = 'para'
  let blankPending = false

  const flush = () => {
    const trimmed = html.replace(/\s+/g, ' ').trim()
    const text = htmlToText(trimmed).trim()
    if (text) {
      lines.push({ kind, html: trimmed, text, blankBefore: blankPending || lines.length === 0 })
      blankPending = false
    }
    html = ''
  }

  const walkInline = (node: Node): string => {
    if (node.nodeType === 3) return escapeHtml((node.textContent ?? '').replace(NBSP, ' '))
    if (node.nodeType !== 1) return ''
    const element = node as Element
    const inner = [...element.childNodes].map(walkInline).join('')
    const tag = INLINE_TAGS[element.tagName]
    if (tag) return inner.trim() ? `<${tag}>${inner}</${tag}>` : inner
    if (element.tagName === 'A' && element.getAttribute('href')) {
      return `<a href="${escapeHtml(element.getAttribute('href') ?? '')}">${inner}</a>`
    }
    return inner
  }

  const walk = (node: Node) => {
    if (node.nodeType !== 1) {
      html += walkInline(node)
      return
    }
    const element = node as Element
    const tag = element.tagName

    if (tag === 'BR') {
      flush()
      return
    }

    if (!BLOCK_TAGS.has(tag) && !element.querySelector([...BLOCK_TAGS, 'BR'].join(','))) {
      html += walkInline(element)
      return
    }

    flush()
    const previousKind = kind
    if (tag === 'LI') kind = 'item'
    else if (/^H[1-6]$/.test(tag)) kind = 'heading'
    for (const child of element.childNodes) walk(child)
    flush()
    kind = previousKind
    if (tag === 'P' || tag === 'DIV' || /^H[1-6]$/.test(tag)) blankPending = true
  }

  for (const child of fragment.childNodes) walk(child)
  flush()

  return lines
}

function isStrongOnly(line: TLine): boolean {
  const strongText = [...line.html.matchAll(/<strong>(.*?)<\/strong>/g)].map((m) => htmlToText(m[1] ?? '')).join('')
  return strongText.replace(/\s+/g, '') === line.text.replace(/\s+/g, '')
}

function classifyLineKinds(lines: TLine[]): TLine[] {
  return lines.map((line, index) => {
    if (line.kind !== 'para') return line

    if (ITEM_MARKER.test(line.text) && line.text.replace(ITEM_MARKER, '').trim()) {
      const html = line.html.replace(ITEM_MARKER_HTML, '$1')
      return { ...line, kind: 'item', html, text: htmlToText(html).trim() }
    }

    if (line.text.length <= HEADING_MAX_LENGTH && isStrongOnly(line)) return { ...line, kind: 'heading' }

    const next = lines[index + 1]
    const isPlainHeading =
      line.text.length <= PLAIN_HEADING_MAX_LENGTH &&
      line.text.includes(' ') &&
      !/[.!?:;,…]$/.test(line.text) &&
      /^\p{Lu}/u.test(line.text) &&
      next !== undefined &&
      !next.blankBefore
    return isPlainHeading ? { ...line, kind: 'heading' } : line
  })
}

function groupBlocks(lines: TLine[]): TBlock[] {
  const blocks: TBlock[] = []

  for (const line of lines) {
    const last = blocks.at(-1)

    if (line.kind === 'heading') {
      blocks.push({ type: 'heading', line })
      continue
    }

    const continuesList =
      line.kind === 'para' &&
      /^\p{Ll}/u.test(line.text) &&
      (last?.type === 'list' || (last?.type === 'paragraph' && last.line.text.endsWith(':')))

    if (line.kind === 'item' || continuesList) {
      const item = { ...line, kind: 'item' as const }
      if (last?.type === 'list') last.items.push(item)
      else if (last?.type === 'paragraph' && last.line.text.endsWith(':')) {
        blocks[blocks.length - 1] = { type: 'list', intro: last.line, items: [item] }
      } else blocks.push({ type: 'list', intro: null, items: [item] })
      continue
    }

    blocks.push({ type: 'paragraph', line })
  }

  return blocks
}

function splitSentences(html: string): string[] {
  const sentences: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < html.length; i++) {
    const char = html[i]
    if (char === '<') {
      depth += html[i + 1] === '/' ? -1 : 1
      i = html.indexOf('>', i)
      if (i === -1) break
      continue
    }
    if (!/[.!?]/.test(char ?? '')) continue

    const boundary = /^[.!?)»"]*((?:<\/[a-z]+>)*)(\s+(?!\p{Ll})|(?=\p{Lu}[\p{Ll}'’]))/u.exec(html.slice(i + 1))
    if (!boundary || (boundary[1]?.match(/</g)?.length ?? 0) !== depth) continue
    const end = i + 1 + boundary[0].length
    sentences.push(html.slice(start, end).trim())
    start = end
    depth = 0
    i = end - 1
  }

  const tail = html.slice(start).trim()
  if (tail) sentences.push(tail)
  return sentences
}

function score(text: string): TScores {
  const normalized = normalize(text)
  const scores = sumScores([])
  for (const topic of TOPICS) {
    for (const [pattern, weight] of RULES[topic]) {
      scores[topic] += (normalized.match(pattern)?.length ?? 0) * weight
    }
  }
  return scores
}

function withBonus(scores: TScores, topic: TTopic | null, bonus: number): TScores {
  return topic ? { ...scores, [topic]: scores[topic] + bonus } : scores
}

function bestTopic(scores: TScores, preferred: TTopic | null = null): TTopic | null {
  let best: TTopic | null = null
  for (const topic of TOPICS) {
    if (scores[topic] > 0 && (best === null || scores[topic] > scores[best])) best = topic
  }
  return best && preferred && scores[preferred] === scores[best] ? preferred : best
}

function sumScores(all: TScores[]): TScores {
  const total = { practicalInfo: 0, receptionAndContact: 0, servicesAndEquipment: 0, locationAndProximity: 0 }
  for (const scores of all) for (const topic of TOPICS) total[topic] += scores[topic]
  return total
}

function maxScore(scores: TScores): number {
  return Math.max(...Object.values(scores))
}

function fillGaps(topics: (TTopic | null)[], fallback: TTopic | null): TSection[] {
  return topics.map((topic, index) => {
    if (topic) return topic
    const previous = topics.slice(0, index).reverse().find(Boolean)
    const next = topics.slice(index + 1).find(Boolean)
    return previous ?? next ?? fallback ?? 'otherInformation'
  })
}

type TPart = { section: TSection; kind: 'p' | 'li' | 'heading'; html: string; group: number }

function isTagline(text: string): boolean {
  if (text.length > TAGLINE_MAX_LENGTH || text.endsWith(':')) return false
  return PITCH.test(normalize(text)) || maxScore(score(text)) < 3
}

export function splitDescription(raw: string | null | undefined): TDescriptionSections {
  const empty: TDescriptionSections = {
    tagline: null,
    locationAndProximity: null,
    servicesAndEquipment: null,
    receptionAndContact: null,
    practicalInfo: null,
    otherInformation: null,
  }
  if (!raw?.trim()) return empty

  const blocks = groupBlocks(classifyLineKinds(extractLines(raw)))
  const parts: TPart[] = []
  let tagline: string | null = null
  let headingTopic: TTopic | null = null
  let pendingHeading: TPart | null = null

  const emit = (part: TPart) => {
    if (pendingHeading) parts.push({ ...pendingHeading, section: headingTopic ?? part.section })
    pendingHeading = null
    parts.push(part)
  }

  for (const [group, block] of blocks.entries()) {
    if (block.type === 'heading') {
      if (group === 0 && block.line.text.length <= TAGLINE_MAX_LENGTH) {
        tagline = block.line.text
        continue
      }
      if (pendingHeading) parts.push({ ...pendingHeading, section: headingTopic ?? 'otherInformation' })
      headingTopic = bestTopic(score(block.line.text))
      pendingHeading = { section: 'otherInformation', kind: 'heading', html: block.line.html, group }
      continue
    }

    if (block.type === 'paragraph' && block.line.text.endsWith(':') && block.line.text.length <= HEADING_MAX_LENGTH) {
      if (pendingHeading) parts.push({ ...pendingHeading, section: headingTopic ?? 'otherInformation' })
      headingTopic = bestTopic(score(block.line.text))
      pendingHeading = { section: 'otherInformation', kind: 'p', html: block.line.html, group }
      continue
    }

    if (block.type === 'paragraph') {
      let sentences = splitSentences(block.line.html)
      const first = sentences[0] ? htmlToText(sentences[0]).trim() : ''
      if (group === 0 && isTagline(first)) {
        tagline = first
        sentences = sentences.slice(1)
      }
      const sections = fillGaps(
        sentences.map((sentence) => bestTopic(withBonus(score(htmlToText(sentence)), headingTopic, HEADING_CONTEXT_BONUS), headingTopic)),
        headingTopic,
      )
      sentences.forEach((html, index) => {
        emit({ section: sections[index] ?? 'otherInformation', kind: 'p', html, group })
      })
      continue
    }

    const listScores = sumScores([block.intro, ...block.items].flatMap((line) => (line ? [score(line.text)] : [])))
    const listTopic = bestTopic(withBonus(listScores, headingTopic, HEADING_CONTEXT_BONUS))
    const itemSections = fillGaps(
      block.items.map((item) =>
        bestTopic(withBonus(withBonus(score(item.text), headingTopic, HEADING_CONTEXT_BONUS), listTopic, LIST_CONTEXT_BONUS), listTopic),
      ),
      listTopic ?? headingTopic,
    )

    if (block.intro) {
      const counts = new Map<TSection, number>()
      for (const section of itemSections) counts.set(section, (counts.get(section) ?? 0) + 1)
      const introSection = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'otherInformation'
      emit({ section: introSection, kind: 'p', html: block.intro.html, group: -group - 1 })
    }
    block.items.forEach((item, index) => {
      emit({ section: itemSections[index] ?? 'otherInformation', kind: 'li', html: item.html, group })
    })
  }

  const lastHeading = pendingHeading as TPart | null
  if (lastHeading) parts.push({ ...lastHeading, section: headingTopic ?? 'otherInformation' })

  const result: TDescriptionSections = { ...empty, tagline }
  for (const section of SECTIONS) {
    result[section] = renderParts(parts.filter((part) => part.section === section && part.html))
  }
  return result
}

function renderParts(parts: TPart[]): string | null {
  let html = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    if (part.kind === 'heading') {
      html += `<p><strong>${part.html}</strong></p>`
      continue
    }
    const run: TPart[] = [part]
    while (parts[i + 1]?.kind === part.kind && parts[i + 1]?.group === part.group) {
      run.push(parts[++i] as TPart)
    }
    html +=
      part.kind === 'li'
        ? `<ul>${run.map((item) => `<li>${item.html}</li>`).join('')}</ul>`
        : `<p>${run.map((sentence) => sentence.html).join(' ')}</p>`
  }
  return html ? sanitizeHTML(html) : null
}

/** Version texte (pour les exports CSV) du HTML produit par `splitDescription`. */
export function sectionHtmlToText(html: string | null): string {
  if (!html) return ''
  return htmlToText(
    html
      .replace(/<li>/g, '• ')
      .replace(/<\/(p|li)>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n'),
  ).trim()
}

/** Texte brut d'une description d'origine, débarrassé de son HTML et de ses entités. */
export function descriptionToText(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  return extractLines(raw)
    .map((line) => (line.kind === 'item' ? `• ${line.text}` : line.text))
    .join('\n')
}
