import { z } from 'zod'
import { env } from '~/server/env'
import DOMPurify from '~/utils/dompurify'

const ZWPPage = z.object({ content: z.object({ rendered: z.string() }) })

// WPBakery encode les guillemets de ses attributs en &#8221; (U+201D) dans le REST API
const ACCORDION_RE = /\[vc_accordion_tab[^\]]*title=&#8221;(.*?)&#8221;[^\]]*\]([\s\S]*?)\[\/vc_accordion_tab\]/g

export async function getWordpressFaqArticles() {
  if (!env.WP_FAQ_URL || !env.WP_FAQ_PAGE_ID) return []
  try {
    const res = await fetch(`${env.WP_FAQ_URL}/wp-json/wp/v2/pages/${env.WP_FAQ_PAGE_ID}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const parsed = ZWPPage.safeParse(await res.json())
    if (!parsed.success) return []

    const content = parsed.data.content.rendered
    return Array.from(content.matchAll(ACCORDION_RE), ([, rawQuestion, rawAnswer]) => ({
      question: DOMPurify.sanitize(rawQuestion, { ALLOWED_TAGS: [] }),
      answer: DOMPurify.sanitize(rawAnswer.replace(/\[[^\]]+\]/g, '')),
    }))
  } catch {
    return []
  }
}
