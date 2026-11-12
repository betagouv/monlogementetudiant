import { OpenAPIHono, type z } from '@hono/zod-openapi'
import { ZApiAccommodationsResponse, ZApiError } from '~/schemas/api/v1'
import type { queryPublicAccommodations } from '~/server/accommodations/list-query'
import { createCallerFactory } from '~/server/trpc/init'
import { appRouter } from '~/server/trpc/router'
import type { ApiV1Env } from './middlewares'

/** Fabrique un OpenAPIHono partageant la gestion d'erreur de validation (query invalide → 400 JSON lisible). */
export const createApiHono = () =>
  new OpenAPIHono<ApiV1Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ error: `Paramètres invalides : ${result.error.issues.map((i) => i.message).join(', ')}` }, 400)
      }
    },
  })

// Caller tRPC public (contexte sans session) : réutilise la logique interne (territoires, détail d'une
// résidence) sans repasser par le transport HTTP/superjson.
export const publicCaller = createCallerFactory(appRouter)({ session: null, clientIp: null })

export const errorResponses = {
  400: { description: 'Paramètres invalides.', content: { 'application/json': { schema: ZApiError } } },
  401: { description: "Clé d'API manquante ou invalide.", content: { 'application/json': { schema: ZApiError } } },
  429: { description: 'Quota de requêtes dépassé.', content: { 'application/json': { schema: ZApiError } } },
} as const

export const forbiddenResponse = {
  403: { description: "Clé d'API non rattachée à un bailleur.", content: { 'application/json': { schema: ZApiError } } },
} as const

export const security = [{ ApiKeyAuth: [] as string[] }]

type ListResult = Awaited<ReturnType<typeof queryPublicAccommodations>>
type ListItem = ListResult['results'][number]
// Sous-ensemble structurel commun à `queryPublicAccommodations` et au caller `listExpandedByCity`
// (dont le early-return « ville introuvable » n'inclut pas `crousCounts`).
export type SerializableList = {
  count: number
  next: string | null
  previous: string | null
  minPrice: number | null
  maxPrice: number | null
  pageSize: number
  results: ListItem[]
}

/** Sérialise une résidence (Date → string ISO) pour une sortie JSON conforme au schéma OpenAPI. */
const serializeAccommodation = (a: ListItem): z.infer<typeof ZApiAccommodationsResponse>['results'][number] => ({
  ...a,
  updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt ?? ''),
})

export const serializeList = (r: SerializableList): z.infer<typeof ZApiAccommodationsResponse> => ({
  count: r.count,
  next: r.next,
  previous: r.previous,
  minPrice: r.minPrice,
  maxPrice: r.maxPrice,
  pageSize: r.pageSize,
  results: r.results.map(serializeAccommodation),
})
