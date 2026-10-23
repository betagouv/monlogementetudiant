import { buildWpPath, redirectToWp, wpNotFound } from '~/utils/wp-redirect'

type RouteContext = { params: Promise<{ slug?: string[] }> }

// Pages « partenariat » exposées sous /landing.
async function handler(request: Request, { params }: RouteContext) {
  const segments = (await params).slug ?? []
  const path = segments.length === 0 ? '/partenariat/' : buildWpPath('/partenariat', segments)
  if (path === null) return wpNotFound()

  return redirectToWp(request, path)
}

export { handler as GET }
