import { getCanonicalUrl } from '~/utils/canonical'
import { formatCityWithA } from '~/utils/french-contraction'
import { type BreadcrumbItem, type LodgingData } from '~/utils/schema'

type AccommodationJsonLdParams = {
  name: string
  address: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
  imagesUrls: string[] | null
  priceMin: number | null
  priceMax: number | null
  description: string | null
  slug: string
}

export function getAccommodationBreadcrumbItems(name: string, city: string, slug: string): BreadcrumbItem[] {
  const cityFormatted = formatCityWithA(city)
  const accommodationUrl = getCanonicalUrl(`/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${slug}`)

  return [
    { name: 'Accueil', item: getCanonicalUrl('/') },
    {
      name: `Trouver un logement étudiant ${cityFormatted}`,
      item: getCanonicalUrl(`/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}`),
    },
    { name, item: accommodationUrl },
  ]
}

export function getAccommodationLodgingData(params: AccommodationJsonLdParams): LodgingData {
  const accommodationUrl = getCanonicalUrl(`/trouver-un-logement-etudiant/ville/${encodeURIComponent(params.city)}/${params.slug}`)

  return {
    name: params.name,
    address: params.address,
    city: params.city,
    postalCode: params.postalCode,
    latitude: params.latitude,
    longitude: params.longitude,
    images: params.imagesUrls ?? [],
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    description: params.description,
    url: accommodationUrl,
  }
}
