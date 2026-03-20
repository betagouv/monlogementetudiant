'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { TRPCProvider } from '~/server/trpc/client'
import { makeQueryClient } from '~/server/trpc/query-client'
import type { AppRouter } from '~/server/trpc/router'

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

function getUrl() {
  const base = typeof window !== 'undefined' ? '' : (process.env.BASE_URL ?? 'http://localhost:3000')
  return `${base}/api/trpc`
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
          async fetch(url, options) {
            const res = await globalThis.fetch(url, options)
            if (res.status === 503) {
              window.location.reload()
            }
            return res
          },
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
