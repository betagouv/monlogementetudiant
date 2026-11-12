import { createRoute, type z } from '@hono/zod-openapi'
import { ZApiContact, ZApiContactIdParam, ZApiContactsListQuery, ZApiContactsResponse, ZApiError } from '~/schemas/api/v1'
import { getOwnerContact, listOwnerContacts, type TApiContactRow } from '../contacts-query'
import { createApiHono, errorResponses, forbiddenResponse, security } from '../shared'

export const contactsApp = createApiHono()

const TAG = 'Demandes de contact'

const serializeContact = (r: TApiContactRow): z.infer<typeof ZApiContact> => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  contactedAt: r.contactedAt?.toISOString() ?? null,
  purgedAt: r.purgedAt?.toISOString() ?? null,
})

const listRoute = createRoute({
  method: 'get',
  path: '/contacts',
  tags: [TAG],
  summary: 'Lister les demandes de contact',
  description:
    "Réservé aux clés d'API rattachées à un bailleur, en lecture seule. " +
    'Les coordonnées des demandeurs sont exposées 30 jours après le dépôt : le bailleur doit appliquer la même durée de conservation à sa copie. ' +
    'Une demande peut disparaître définitivement (compte étudiant supprimé, résidence supprimée ou changée de bailleur) sans être signalée. ' +
    '`include_purged=true` renvoie aussi les demandes de plus de 30 jours, sans données personnelles (`purged: true`, `student: null`).',
  security,
  request: { query: ZApiContactsListQuery },
  responses: {
    200: { description: 'Liste paginée de demandes de contact.', content: { 'application/json': { schema: ZApiContactsResponse } } },
    ...forbiddenResponse,
    ...errorResponses,
  },
})

contactsApp.openapi(listRoute, async (c) => {
  const q = c.req.valid('query')
  // Garanti par `requireOwnerKey` monté en amont.
  const ownerId = c.get('apiKey').ownerId as number
  const { count, results } = await listOwnerContacts(ownerId, {
    createdSince: q.created_since,
    createdUntil: q.created_until,
    updatedSince: q.updated_since,
    residence: q.residence,
    externalReference: q.external_reference,
    statuses: q.status,
    includePurged: q.include_purged ?? false,
    page: q.page,
    pageSize: q.page_size,
    order: q.order,
  })
  const totalPages = Math.ceil(count / q.page_size)
  return c.json(
    {
      count,
      next: q.page < totalPages ? String(q.page + 1) : null,
      previous: q.page > 1 ? String(q.page - 1) : null,
      pageSize: q.page_size,
      results: results.map(serializeContact),
    },
    200,
  )
})

const detailRoute = createRoute({
  method: 'get',
  path: '/contacts/{id}',
  tags: [TAG],
  summary: "Détail d'une demande de contact",
  description:
    "Réservé aux clés d'API rattachées à un bailleur. Une demande de plus de 30 jours est renvoyée sans données personnelles (`purged: true`, `student: null`).",
  security,
  request: { params: ZApiContactIdParam },
  responses: {
    200: { description: 'Demande de contact.', content: { 'application/json': { schema: ZApiContact } } },
    404: { description: 'Demande introuvable.', content: { 'application/json': { schema: ZApiError } } },
    ...forbiddenResponse,
    ...errorResponses,
  },
})

contactsApp.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid('param')
  const contact = await getOwnerContact(c.get('apiKey').ownerId as number, id)
  if (!contact) return c.json({ error: 'Demande introuvable.' }, 404)
  return c.json(serializeContact(contact), 200)
})
