import * as Sentry from '@sentry/nextjs'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createTRPCContext } from '~/server/trpc/init'
import { appRouter } from '~/server/trpc/router'

const handler = (req: Request) =>
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

export { handler as GET, handler as POST }
