import { Scalar } from '@scalar/hono-api-reference'
import * as Sentry from '@sentry/nextjs'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { env } from '~/server/env'
import { apiKeyMiddleware, requireFeatureEnabled, requireOwnerKey } from './middlewares'
import { accommodationsApp } from './routes/accommodations'
import { territoriesApp } from './routes/territories'
import { createApiHono } from './shared'

const app = createApiHono().basePath('/api/v1')

// --- Middlewares ---
app.use('*', requireFeatureEnabled)
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], allowHeaders: ['x-api-key', 'content-type'] }))
for (const path of ['/accommodations', '/accommodations/*', '/cities', '/departments', '/academies', '/territories/*']) {
  app.use(path, apiKeyMiddleware)
}
for (const path of ['/contacts', '/contacts/*']) {
  app.use(path, apiKeyMiddleware, requireOwnerKey)
}

// --- Routes (une sous-app OpenAPI par domaine) ---
app.route('/', accommodationsApp)
app.route('/', territoriesApp)

// --- OpenAPI document + Scalar ---
app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
})

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'API Mon Logement Étudiant',
    version: '1.0.0',
    description:
      'API publique en lecture seule du catalogue des résidences étudiantes et des territoires. ' +
      "Une clé d'API (en-tête « x-api-key ») est requise sur tous les endpoints de données.",
  },
  // Les chemins du doc incluent déjà « /api/v1 » (basePath) : le serveur ne porte donc que l'origine.
  servers: [{ url: env.BASE_URL, description: env.NEXT_PUBLIC_APP_ENV }],
})

app.get(
  '/docs',
  Scalar({
    url: '/api/v1/openapi.json',
    pageTitle: 'API Mon Logement Étudiant',
  }),
)

// --- Gestion d'erreurs JSON ---
app.notFound((c) => c.json({ error: 'Ressource introuvable.' }, 404))

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status)
  }
  Sentry.captureException(error, { tags: { route: 'api/v1' } })
  return c.json({ error: 'Erreur interne du serveur.' }, 500)
})

export { app as apiV1App }
