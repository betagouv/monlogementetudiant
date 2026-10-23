const WP_ORIGIN = 'https://info.monlogementetudiant.beta.gouv.fr'

/** Un segment d'URL WordPress : un slug, rien d'autre (ni `..`, ni `?`, ni `.php`). */
const SLUG_SEGMENT = /^[a-z0-9-]+$/

/**
 * Construit le chemin WordPress d'une page, ou `null` si un segment n'est pas un slug.
 * Les liens de l'app envoient parfois un nom de ville brut (« Nîmes », « Le Mans ») : il est ramené à
 * la forme de slug WordPress avant validation.
 */
export function buildWpPath(prefix: string, segments: string[]): string | null {
  const slugs = segments.map((segment) =>
    segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-'),
  )
  if (slugs.some((slug) => !SLUG_SEGMENT.test(slug))) return null
  return `${prefix}/${slugs.join('/')}/`
}

export const wpNotFound = () => new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/**
 * Redirige vers une page du WordPress `info.`. Le thème a besoin de ses scripts pour s'afficher : la page
 * doit tourner sur sa propre origine, pas être relayée sous celle de l'application.
 */
export function redirectToWp(request: Request, path: string) {
  const target = new URL(path, WP_ORIGIN)
  target.search = new URL(request.url).search
  return Response.redirect(target, 302)
}
