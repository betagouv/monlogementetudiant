import type { getTranslations } from 'next-intl/server'
import { getCanonicalUrl } from '~/utils/canonical'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import { getAccommodationPath } from '~/utils/get-accommodation-url'
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

type TBreadcrumbsTranslator = Awaited<ReturnType<typeof getTranslations<'breadcrumbs'>>>

export function getAccommodationBreadcrumbItems(
  t: TBreadcrumbsTranslator,
  locale: string,
  name: string,
  city: string,
  slug: string,
): BreadcrumbItem[] {
  const locationFormatted = formatCityWithPreposition(locale, 'à', city)
  const accommodationUrl = getCanonicalUrl(getAccommodationPath(city, slug))

  return [
    { name: t('homeLabel'), item: getCanonicalUrl('/') },
    {
      name: t('findAccomodationWithLocation', { locationFormatted }),
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
