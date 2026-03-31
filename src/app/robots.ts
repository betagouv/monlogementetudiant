import type { MetadataRoute } from 'next'
import { z } from 'zod'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = z.string().parse(process.env.BASE_URL)

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
