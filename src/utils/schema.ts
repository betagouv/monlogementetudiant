import { z } from 'zod'

function getBaseUrl() {
  return z.string().parse(process.env.BASE_URL)
}

export type BreadcrumbItem = {
  name: string
  item?: string
}

export type FaqItem = {
  question: string
  answer: string
}

export type LodgingData = {
  name: string
  address: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
  images: string[]
  priceMin: number | null
  priceMax: number | null
  description: string | null
  url: string
}

export function buildOrganizationSchema() {
  const baseUrl = getBaseUrl()

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Mon Logement Étudiant',
    url: baseUrl,
    logo: `${baseUrl}/favicon.svg`,
    sameAs: ['https://beta.gouv.fr/startups/je-deviens-etudiant.html'],
  }
}

export function buildWebSiteSchema() {
  const baseUrl = getBaseUrl()

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mon Logement Étudiant',
    url: baseUrl,
    description:
      "Plateforme nationale pour faciliter l'acces au logement des etudiants boursiers. Recherchez parmi les residences conventionnees, simulez vos aides au logement et preparez votre budget.",
  }
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.item ? { item: item.item } : {}),
    })),
  }
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function buildLodgingSchema(data: LodgingData) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: data.name,
    url: data.url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address,
      addressLocality: data.city,
      postalCode: data.postalCode,
      addressCountry: 'FR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: data.latitude,
      longitude: data.longitude,
    },
  }

  if (data.images.length > 0) {
    schema.image = data.images
  }

  if (data.priceMin !== null) {
    schema.priceRange =
      data.priceMax !== null && data.priceMax !== data.priceMin
        ? `De ${data.priceMin} € à ${data.priceMax} €`
        : `À partir de ${data.priceMin} €`
  }

  if (data.description) {
    schema.description = data.description
  }

  return schema
}
