import type { MetadataRoute } from 'next'
import { env } from '~/server/env'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.BASE_URL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/administration*', '/bailleur*', '/mon-espace*', '/api/*', '/widget/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
