/**
 * Stub des APIs de géocodage pour les tests d'import. Réponses routées par URL plutôt
 * qu'empilées avec `mockResolvedValueOnce` : `resolveAddressLocation` interroge geo.api.gouv.fr
 * puis la BAN et met les communes en cache par process, l'ordre des `fetch` n'est pas prévisible.
 */

export type TGeocodingPlace = {
  postalCode: string
  city: string
  lat: number
  lng: number
  /** Libellé de voie renvoyé par la BAN. Par défaut, la voie interrogée. */
  address?: string
  inseeCode?: string
  population?: number
}

type TStubResponse = {
  ok: boolean
  status: number
  headers: Headers
  json: () => Promise<unknown>
}

function jsonResponse(body: unknown): TStubResponse {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Les codes postaux d'outre-mer portent le département sur trois chiffres. */
function departmentOf(postalCode: string): string {
  return postalCode.startsWith('97') || postalCode.startsWith('98') ? postalCode.slice(0, 3) : postalCode.slice(0, 2)
}

function inseeOf(place: TGeocodingPlace): string {
  return place.inseeCode ?? `${departmentOf(place.postalCode)}000`
}

export function createGeocodingStub(places: TGeocodingPlace[]) {
  const communesCalls: string[] = []
  const searchCalls: string[] = []

  function communesResponse(url: string): TStubResponse {
    communesCalls.push(url)
    const postalCode = new URL(url).searchParams.get('codePostal') ?? ''
    const matching = places.filter((place) => place.postalCode === postalCode)
    return jsonResponse(
      matching.map((place) => ({
        nom: place.city,
        code: inseeOf(place),
        codeDepartement: departmentOf(place.postalCode),
        codesPostaux: [place.postalCode],
        centre: { type: 'Point', coordinates: [place.lng, place.lat] },
        population: place.population ?? 1000,
      })),
    )
  }

  function searchResponse(url: string): TStubResponse {
    searchCalls.push(url)
    const query = new URL(url).searchParams.get('q') ?? ''
    const normalizedQuery = normalize(query)
    const place =
      places.find((candidate) => query.includes(candidate.postalCode)) ??
      places.find((candidate) => normalizedQuery.includes(normalize(candidate.city)))
    if (!place) return jsonResponse({ features: [] })

    const street = place.address ?? query.replace(place.postalCode, '').replace(new RegExp(place.city, 'i'), '').trim()
    return jsonResponse({
      features: [
        {
          geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
          properties: {
            label: `${street} ${place.postalCode} ${place.city}`,
            name: street,
            city: place.city,
            postcode: place.postalCode,
            citycode: inseeOf(place),
            depcode: departmentOf(place.postalCode),
          },
        },
      ],
    })
  }

  return {
    communesCalls,
    searchCalls,

    /** Vrai si l'URL relève du géocodage et doit être servie par ce stub. */
    handles(url: unknown): url is string {
      return typeof url === 'string' && (url.includes('geo.api.gouv.fr') || url.includes('/geocodage/'))
    },

    respond(url: string): Promise<TStubResponse> {
      if (url.includes('/geocodage/')) return Promise.resolve(searchResponse(url))
      if (url.includes('/communes?')) return Promise.resolve(communesResponse(url))
      // Endpoints geo.api.gouv.fr non utilisés par ces imports (commune par
      // code INSEE, communes d'un département).
      return Promise.resolve(jsonResponse([]))
    },

    reset() {
      communesCalls.length = 0
      searchCalls.length = 0
    },
  }
}
