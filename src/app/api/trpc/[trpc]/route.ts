import * as Sentry from '@sentry/nextjs'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createTRPCContext } from '~/server/trpc/init'
import { appRouter } from '~/server/trpc/router'
import { crossOriginForbidden, isSameOriginRequest } from '~/server/utils/same-origin'

const handleTRPC = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    // Un batch non borné multiplie en une seule requête HTTP le coût des procédures publiques.
    // Le client découpe ses batchs à `maxItems` (trpc-client.tsx), qui doit rester inférieur.
    maxBatchSize: 20,
    router: appRouter,
    createContext: createTRPCContext,
    onError: ({ error, path }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        Sentry.captureException(error, {
          tags: { trpc_path: path },
        })
      }
    },
  })

/**
 * Le client tRPC n'envoie que du JSON. tRPC accepte aussi `multipart/form-data` et `octet-stream`, que
 * n'importe quelle page peut poster sans requête préalable (CORS « simple ») : une mutation sans
 * `.input()` (ex. `dossierFacile.disconnect`) s'exécuterait alors avec les cookies de la victime.
 */
const handler = (req: Request) => {
  if (req.method === 'POST') {
    if (!req.headers.get('content-type')?.startsWith('application/json')) {
      return Response.json({ error: 'Type de contenu non pris en charge.' }, { status: 415 })
    }
    if (!isSameOriginRequest(req)) return crossOriginForbidden()
  }
  return handleTRPC(req)
}

export { handler as GET, handler as POST }
