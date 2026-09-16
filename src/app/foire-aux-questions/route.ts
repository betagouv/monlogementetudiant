import { proxyWp } from '~/utils/wp-proxy'

// Proxy caché vers la FAQ WordPress.
const handler = (request: Request) => proxyWp(request, { path: '/foire-aux-questions/' })

export { handler as GET }
