import { buildWpPath, proxyWp, wpNotFound } from '~/utils/wp-proxy'

type RouteContext = { params: Promise<{ slug?: string[] }> }

// Proxy caché vers l'espace « préparer sa vie étudiante ». Le chemin nu renvoie vers la racine WordPress.
async function handler(request: Request, { params }: RouteContext) {
  const segments = (await params).slug ?? []
  const path = segments.length === 0 ? '' : buildWpPath('/preparer-sa-vie-etudiante', segments)
  if (path === null) return wpNotFound()

  return proxyWp(request, { path })
}

export { handler as GET }
