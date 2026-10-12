import type { MetadataRoute } from 'next'
import { env } from '~/server/env'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.BASE_URL

  return {
    rules: [
      {
        userAgent: '*',
        // embed.js doit rester accessible aux crawlers : les pages qui intègrent le widget
        // ne peuvent pas être rendues sans lui (la règle allow la plus longue prime).
        allow: ['/', '/widget/embed.js'],
        disallow: ['/administration*', '/bailleur*', '/mon-espace*', '/api/*', '/widget/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
