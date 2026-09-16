import { z } from '@hono/zod-openapi'
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
  crous: boolParam('Ne renvoyer que les résidences CROUS (true) ou exclure le CROUS (false, défaut).'),
  accessible: boolParam('Ne renvoyer que les résidences avec logements PMR.'),
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
    crous: boolParam('CROUS uniquement (true) ou exclure le CROUS (false, défaut).'),
    accessible: boolParam('Logements PMR uniquement.'),
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
