import { buildWpPath, proxyWp, wpNotFound } from '~/utils/wp-proxy'

type RouteContext = { params: Promise<{ slug?: string[] }> }

// Proxy caché vers les pages « partenariat » exposées sous /landing.
async function handler(request: Request, { params }: RouteContext) {
  const segments = (await params).slug ?? []
  const path = segments.length === 0 ? '/partenariat/' : buildWpPath('/partenariat', segments)
  if (path === null) return wpNotFound()

  return proxyWp(request, { path })
}

export { handler as GET }
