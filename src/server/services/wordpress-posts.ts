import { z } from 'zod'
import DOMPurify from '~/utils/dompurify'

const WP_POSTS_API_URL = 'https://info.monlogementetudiant.beta.gouv.fr/wp-json/wp/v2/posts'
const DEFAULT_POST_LIMIT = 3

const ZWordpressPost = z.object({
  id: z.number(),
  title: z.object({ rendered: z.string() }),
  excerpt: z.object({ rendered: z.string() }),
  link: z.url(),
  _embedded: z
    .object({
      'wp:featuredmedia': z
        .array(
          z.object({
            source_url: z.url(),
            alt_text: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

const ZWordpressPosts = z.array(ZWordpressPost)

export type WordpressPost = {
  id: number
  title: string
  excerpt: string
  link: string
  imageUrl?: string
  imageAlt: string
}

function sanitizeText(html: string): string {
  const cleaned = html.replace(/\[.*?\]/g, '')
  return DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] })
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&#160;/g, '\u00a0')
    .trim()
}

export async function getLatestWordpressPosts({ limit = DEFAULT_POST_LIMIT }: { limit?: number } = {}): Promise<WordpressPost[]> {
  try {
    const params = new URLSearchParams({
      per_page: String(limit),
      _embed: '1',
      orderby: 'date',
      order: 'desc',
    })
    const res = await fetch(`${WP_POSTS_API_URL}?${params.toString()}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const parsed = ZWordpressPosts.safeParse(await res.json())
    if (!parsed.success) return []

    return parsed.data.map((post) => {
      const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0]

      return {
        id: post.id,
        title: sanitizeText(post.title.rendered),
        excerpt: sanitizeText(post.excerpt.rendered),
        link: post.link,
        imageUrl: featuredMedia?.source_url,
        imageAlt: featuredMedia?.alt_text ?? '',
      }
    })
  } catch {
    return []
  }
}

export const _internal = {
  sanitizeText,
}
