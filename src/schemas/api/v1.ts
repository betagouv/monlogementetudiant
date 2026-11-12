import { z } from '@hono/zod-openapi'
import { ZContactStatus } from '~/enums/contact-status'
import { ZAccomodation, ZAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { ZBbox, ZTerritories } from '~/schemas/territories'

/**
 * Schémas Zod publics de l'API REST v1 (requêtes + réponses), enrichis de métadonnées OpenAPI
 * (`.openapi()`) en français pour la doc Scalar. Les schémas de réponse réutilisent les schémas
 * internes existants, en surchargeant `updatedAt` (Date → string ISO) pour rester JSON/OpenAPI-safe.
 */

// --- Helpers de paramètres de query (les valeurs d'URL sont toujours des strings) ---

/** Liste séparée par des virgules → tableau de tokens nettoyés. */
const csvParam = (config: { description: string; example: string }) =>
  z
    .string()
    .max(2000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined,
    )
    .openapi({ description: config.description, example: config.example })

/** Booléen de query robuste ("true"/"false") — `z.coerce.boolean()` traiterait "false" comme vrai. */
const boolParam = (description: string) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'))
    .openapi({ description, example: 'true' })

const intParam = (config: { description: string; example: number; min?: number; max?: number }) => {
  let schema = z.coerce.number().int()
  if (config.min != null) schema = schema.min(config.min)
  if (config.max != null) schema = schema.max(config.max)
  return schema.openapi({ description: config.description, example: config.example })
}

// --- Requêtes ---

export const ZAccommodationsListQuery = z.object({
  city_slugs: csvParam({
    description: 'Slugs de villes séparés par des virgules (filtre géométrique ST_Within, iso carte).',
    example: 'paris,lyon',
  }),
  department: csvParam({
    description: 'Départements par code ou slug, séparés par des virgules.',
    example: '75,69',
  }),
  academie: csvParam({
    description: "Slugs d'académies séparés par des virgules.",
    example: 'paris,lyon',
  }),
  postal_codes: csvParam({
    description: 'Codes postaux séparés par des virgules (filtre attributaire).',
    example: '75001,69001',
  }),
  bbox: z
    .string()
    .max(200)
    .optional()
    .openapi({ description: 'Rectangle englobant "xmin,ymin,xmax,ymax" (WGS84).', example: '2.25,48.81,2.42,48.90' }),
  center: z
    .string()
    .max(200)
    .optional()
    .openapi({ description: 'Centre "lng,lat" pour une recherche par rayon.', example: '2.3522,48.8566' }),
  radius: z.coerce
    .number()
    .positive()
    .max(100)
    .default(10)
    .openapi({ description: 'Rayon en km, 100 max (utilisé avec center).', example: 10 }),
  price_max: intParam({ description: 'Loyer minimum maximal (€/mois).', example: 600, min: 0, max: 100_000 }).optional(),
  crous: boolParam('Ne renvoyer que les résidences Crous (true) ou exclure le Crous (false, défaut).'),
  accessible: boolParam('Ne renvoyer que les résidences avec logements adaptés PMR.'),
  coliving: boolParam('Ne renvoyer que les résidences proposant de la colocation.'),
  available: boolParam('Ne renvoyer que les résidences avec des disponibilités.'),
  owner_slug: z.string().max(200).optional().openapi({ description: "Slug d'un gestionnaire/bailleur.", example: 'crous-paris' }),
  page: intParam({ description: 'Numéro de page (à partir de 1, 1000 max).', example: 1, min: 1, max: 1000 }).default(1),
  page_size: intParam({ description: 'Taille de page (max 100).', example: 12, min: 1, max: 100 }).default(12),
})

export const ZNearbyQuery = z
  .object({
    center: z.string().max(200).optional().openapi({ description: 'Centre "lng,lat".', example: '2.3522,48.8566' }),
    city: z
      .string()
      .max(200)
      .optional()
      .openapi({ description: "Slug (ou nom) d'une ville : renvoie les résidences alentour.", example: 'paris' }),
    radius: z.coerce.number().positive().max(100).default(10).openapi({ description: 'Rayon en km (100 max).', example: 10 }),
    crous: boolParam('Crous uniquement (true) ou exclure le Crous (false, défaut).'),
    accessible: boolParam('Logements adaptés PMR uniquement.'),
    coliving: boolParam('Colocation uniquement.'),
    available: boolParam('Disponibilités uniquement.'),
    price_max: intParam({ description: 'Loyer minimum maximal (€/mois).', example: 600, min: 0, max: 100_000 }).optional(),
    page: intParam({ description: 'Numéro de page (1000 max).', example: 1, min: 1, max: 1000 }).default(1),
    page_size: intParam({ description: 'Taille de page (max 100).', example: 6, min: 1, max: 100 }).default(12),
  })
  .openapi('NearbyQuery')

const searchParam = z
  .string()
  .max(100)
  .optional()
  .openapi({ description: 'Recherche textuelle par nom (insensible à la casse).', example: 'gren' })

export const ZCitiesQuery = z.object({
  department: z.string().max(10).optional().openapi({ description: 'Filtrer par code de département.', example: '75' }),
  popular: boolParam('Ne renvoyer que les villes marquées « populaires ».'),
  search: searchParam,
})

/** Query commune aux listes de départements et d'académies. */
export const ZTerritoryListQuery = z.object({
  search: searchParam,
})

export const ZTerritorySearchQuery = z.object({
  q: z.string().min(1).openapi({ description: 'Texte recherché (ville, département, académie).', example: 'gren' }),
})

export const ZSlugParam = z.object({
  slug: z
    .string()
    .min(1)
    .openapi({ param: { name: 'slug', in: 'path' }, description: 'Slug de la résidence.', example: 'les-estudines-paris-est' }),
})

const isoDateParam = (description: string, example: string) =>
  z.iso
    .datetime({ offset: true, message: 'Date invalide (format ISO 8601 attendu)' })
    .optional()
    .transform((v) => (v === undefined ? undefined : new Date(v)))
    .openapi({
      description: `${description} Un « + » de décalage horaire doit être encodé dans l'URL (%2B).`,
      example,
      type: 'string',
      format: 'date-time',
    })

export const ZApiContactsListQuery = z.object({
  created_since: isoDateParam('Demandes déposées à partir de cette date (incluse, ISO 8601).', '2026-11-01T00:00:00Z'),
  created_until: isoDateParam('Demandes déposées avant cette date (exclue, ISO 8601).', '2026-11-30T00:00:00Z'),
  updated_since: isoDateParam('Demandes modifiées à partir de cette date (incluse, ISO 8601).', '2026-11-10T00:00:00Z'),
  residence: z.string().max(200).optional().openapi({ description: 'Slug de la résidence.', example: 'les-estudines-paris-est' }),
  external_reference: z
    .string()
    .max(255)
    .optional()
    .openapi({ description: 'Référence externe de la résidence (celle de votre système).', example: 'RES-0042' }),
  status: z
    .string()
    .max(200)
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined
      const statuses = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      const parsed = z.array(ZContactStatus).safeParse(statuses)
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'Statut inconnu' })
        return z.NEVER
      }
      return parsed.data
    })
    .openapi({
      description: 'Statuts séparés par des virgules : a_contacter, contacte, non_retenu, logement_attribue.',
      example: 'a_contacter,contacte',
      type: 'string',
    }),
  include_purged: boolParam(
    'Renvoyer aussi les demandes de plus de 30 jours, sans données personnelles (`purged: true`, `student: null`).',
  ),
  page: intParam({ description: 'Numéro de page (à partir de 1).', example: 1, min: 1, max: 100_000 }).default(1),
  page_size: intParam({ description: 'Taille de page (max 100).', example: 20, min: 1, max: 100 }).default(20),
  order: z
    .enum(['asc', 'desc'])
    .default('desc')
    .openapi({ description: "Tri par date de dépôt : desc (défaut, plus récentes d'abord) ou asc.", example: 'desc' }),
})

export const ZApiContactIdParam = z.object({
  id: z.uuid({ message: 'Identifiant de demande invalide' }).openapi({
    param: { name: 'id', in: 'path' },
    description: 'Identifiant (UUID) de la demande de contact.',
    example: '0b6f3c1e-8d2a-4c1b-9a57-3f1d2e4a5b6c',
  }),
})

// --- Réponses ---

/** Résidence (objet plat camelCase, `updatedAt` en string ISO pour le JSON). */
export const ZApiAccommodation = ZAccomodation.extend({
  updatedAt: z.string().openapi({ description: 'Date de dernière mise à jour (ISO 8601).' }),
}).openapi('Accommodation')

export const ZApiAccommodationsResponse = z
  .object({
    count: z.number().openapi({ description: 'Nombre total de résidences correspondant aux filtres.' }),
    next: z.string().nullable().openapi({ description: 'Numéro de page suivant, ou null.' }),
    previous: z.string().nullable().openapi({ description: 'Numéro de page précédent, ou null.' }),
    minPrice: z.number().nullable().openapi({ description: 'Loyer minimum observé sur le jeu de résultats.' }),
    maxPrice: z.number().nullable().openapi({ description: 'Loyer maximum observé sur le jeu de résultats.' }),
    pageSize: z.number(),
    results: z.array(ZApiAccommodation),
  })
  .openapi('AccommodationsResponse')

export const ZApiAccommodationDetail = ZAccomodationDetails.extend({
  updatedAt: z.string().openapi({ description: 'Date de dernière mise à jour (ISO 8601).' }),
  addresses: z
    .array(
      z.object({
        address: z.string(),
        city: z.string(),
        postalCode: z.string(),
        isMain: z.boolean(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
      }),
    )
    .optional(),
  citySlug: z.string().nullable(),
  cityBbox: ZBbox.shape.bbox,
  departmentCode: z.string().nullable(),
}).openapi('AccommodationDetail')

export const ZApiCity = ZTerritories.shape.cities.element.openapi('City')

export const ZApiDepartment = z
  .object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    code: z.string(),
    bbox: ZBbox.shape.bbox,
  })
  .openapi('Department')

export const ZApiAcademy = z
  .object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    bbox: ZBbox.shape.bbox,
  })
  .openapi('Academy')

export const ZApiTerritorySearch = ZTerritories.openapi('TerritorySearchResult')

export const ZApiError = z.object({ error: z.string() }).openapi('Error')

const isoDate = (description: string) => z.string().openapi({ description, format: 'date-time' })

export const ZApiContact = z
  .object({
    id: z.string().openapi({ description: 'Identifiant (UUID) de la demande.' }),
    residence: z.object({
      slug: z.string(),
      name: z.string(),
      externalReference: z.string().nullable().openapi({ description: 'Référence externe de la résidence, si renseignée.' }),
    }),
    status: ZContactStatus,
    apartmentType: z.string().nullable().openapi({ description: 'Type de logement demandé.' }),
    createdAt: isoDate('Date de dépôt de la demande (ISO 8601).'),
    updatedAt: isoDate('Date de dernière modification (ISO 8601).'),
    contactedAt: isoDate('Date de prise de contact (ISO 8601).').nullable(),
    purged: z
      .boolean()
      .openapi({ description: 'true si les données personnelles ne sont plus exposées (plus de 30 jours ou anonymisée).' }),
    purgedAt: isoDate("Date d'anonymisation (ISO 8601), si la demande a été anonymisée.").nullable(),
    student: z
      .object({
        firstname: z.string().nullable(),
        lastname: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        birthdate: z.string().nullable(),
        scholarshipStatus: z.string().nullable(),
        isWorkStudy: z.boolean().nullable(),
        studyInstitution: z.string().nullable(),
        studyYear: z.string().nullable(),
      })
      .nullable()
      .openapi({ description: 'Coordonnées du demandeur ; null si la demande est purgée.' }),
  })
  .openapi('Contact')

export const ZApiContactsResponse = z
  .object({
    count: z.number().openapi({ description: 'Nombre total de demandes correspondant aux filtres.' }),
    next: z.string().nullable().openapi({ description: 'Numéro de page suivant, ou null.' }),
    previous: z.string().nullable().openapi({ description: 'Numéro de page précédent, ou null.' }),
    pageSize: z.number(),
    results: z.array(ZApiContact),
  })
  .openapi('ContactsResponse')
