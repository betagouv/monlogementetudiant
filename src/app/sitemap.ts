import type { MetadataRoute } from 'next'
import { z } from 'zod'
import { getAccommodations } from '~/server-only/get-accommodations'
import { getPopularCities } from '~/server-only/get-popular-cities'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const popularCities = await getPopularCities()
  const baseUrl = z.string().parse(process.env.BASE_URL)
  const lastModified = new Date()

  const prepareStudentLifeMetadata: MetadataRoute.Sitemap = popularCities.map((city) => ({
    url: `${baseUrl}/preparer-sa-vie-etudiante/${city.slug}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))
  const findStudentAccommodationMetadata: MetadataRoute.Sitemap = popularCities.map((city) => ({
    url: `${baseUrl}/trouver-un-logement-etudiant/ville/${city.slug}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))
  const { count, page_size } = await getAccommodations({})
  const nbPages = Math.ceil(count / page_size)

  const accommodationPagePromises = Array.from({ length: nbPages }, (_, i) => getAccommodations({ page: String(i + 1) }))

  const allAccommodationPages = await Promise.all(accommodationPagePromises)
  const allFeatures = allAccommodationPages.flatMap((page) => page.results.features)

  const accommodations: MetadataRoute.Sitemap = allFeatures.map((feature) => ({
    url: `${baseUrl}/trouver-un-logement-etudiant/ville/${feature.properties.city.replace(' ', '-').toLowerCase()}/${feature.properties.slug}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/simuler-mes-aides-au-logement`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/preparer-sa-vie-etudiante`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...prepareStudentLifeMetadata,
    {
      url: `${baseUrl}/trouver-un-logement-etudiant`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...findStudentAccommodationMetadata,
    {
      url: `${baseUrl}/foire-aux-questions`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/alerte-logement`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/plan-du-site`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/donnees-personnelles`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.1,
    },
    {
      url: `${baseUrl}/gestion-des-cookies`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.1,
    },
    ...accommodations,
  ]
}
