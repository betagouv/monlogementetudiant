/**
 * Visites virtuelles saisies par les bailleurs : lien vers une visite 3D ou une vidéo hébergée, code
 * d'intégration iframe, ou fichier vidéo.
 *
 * Seules les plateformes de la liste peuvent être intégrées dans la fiche publique : une iframe
 * arbitraire permettrait d'afficher, sous le domaine gouv, une fausse page de connexion.
 */
export const VIRTUAL_TOUR_ALLOWED_DOMAINS = [
  'klapty.com',
  'matterport.com',
  'ricoh360.com',
  'giraffe360.com',
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'vimeo.com',
  // Uniquement Drive : un `*.google.com` ouvrirait Google Sites, où n'importe qui publie une page.
  'drive.google.com',
] as const

export type TVirtualTour = { type: 'embed'; src: string } | { type: 'video'; src: string }

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i
const IFRAME_SRC = /<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

const parseHttpsUrl = (value: string): URL | null => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

export const isAllowedVirtualTourHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase()
  return VIRTUAL_TOUR_ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

/** Adresse intégrable pour les plateformes dont la page de partage refuse l'iframe. */
const toEmbedUrl = (url: URL): string => {
  const host = url.hostname.toLowerCase()
  if ((host === 'youtube.com' || host.endsWith('.youtube.com')) && url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`
  }
  const driveFile = host === 'drive.google.com' ? url.pathname.match(/^\/file\/d\/([\w-]+)\/view/) : null
  if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`
  return url.toString()
}

/**
 * Interprète la saisie du bailleur. Renvoie `null` quand rien n'est affichable : texte libre, lien
 * non https, ou plateforme hors liste. Seul le `src` d'un code d'intégration est conservé ; ses autres
 * attributs (`allow`, `sandbox`…) sont fixés au rendu.
 */
export const parseVirtualTour = (input: string | null | undefined): TVirtualTour | null => {
  const trimmed = input?.trim()
  if (!trimmed) return null

  const iframe = trimmed.match(IFRAME_SRC)
  // Plusieurs liens collés à la suite : on garde le premier.
  const raw = iframe ? (iframe[1] ?? iframe[2] ?? iframe[3] ?? '') : trimmed.split(/\s+/)[0]!
  const url = parseHttpsUrl(raw)
  if (!url) return null

  if (!iframe && VIDEO_EXTENSIONS.test(url.pathname)) {
    // Lu par un <video> : ne peut rien afficher d'autre qu'une vidéo, l'hôte importe peu.
    return { type: 'video', src: url.toString() }
  }

  if (!isAllowedVirtualTourHost(url.hostname)) return null
  return { type: 'embed', src: toEmbedUrl(url) }
}

/** Validation de formulaire : un champ vide est accepté, sinon la saisie doit être affichable. */
export const isValidVirtualTourInput = (input: string | null | undefined): boolean => !input?.trim() || parseVirtualTour(input) !== null
