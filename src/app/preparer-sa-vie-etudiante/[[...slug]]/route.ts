import { buildWpPath, redirectToWp, wpNotFound } from '~/utils/wp-redirect'

type RouteContext = { params: Promise<{ slug?: string[] }> }

// Espace « préparer sa vie étudiante ». Le chemin nu renvoie vers la racine WordPress.
async function handler(request: Request, { params }: RouteContext) {
  const segments = (await params).slug ?? []
  const path = segments.length === 0 ? '/' : buildWpPath('/preparer-sa-vie-etudiante', segments)
  if (path === null) return wpNotFound()

  return redirectToWp(request, path)
}

export { handler as GET }
