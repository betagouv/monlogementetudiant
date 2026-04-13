import Button from '@codegouvfr/react-dsfr/Button'
import Card from '@codegouvfr/react-dsfr/Card'
import clsx from 'clsx'
import DOMPurify from 'isomorphic-dompurify'
import { getTranslations } from 'next-intl/server'
import styles from './news.module.css'

const WP_API_URL = 'https://info.monlogementetudiant.beta.gouv.fr/wp-json/wp/v2/posts'

interface WPPost {
  id: number
  title: { rendered: string }
  excerpt: { rendered: string }
  link: string
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url: string
      alt_text?: string
    }>
  }
}

function sanitizeExcerpt(html: string): string {
  const cleaned = html.replace(/\[.*?\]/g, '') // strip WP shortcodes
  return DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] }).trim() // strip all HTML, decode entities
}

async function fetchWPPosts(): Promise<WPPost[]> {
  try {
    const res = await fetch(`${WP_API_URL}?per_page=3&_embed`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export const NewsSection = async () => {
  const tHome = await getTranslations('home')
  const posts = await fetchWPPosts()

  return (
    <section className="fr-container fr-py-4w fr-py-md-8w">
      <div className={clsx('fr-flex fr-direction-column', styles.newsSectionHeader)}>
        <h2 className="fr-h2 fr-mb-0">{tHome('news.title')}</h2>
        <p className={styles.newsHeaderDescription}>{tHome('news.description')}</p>
      </div>
      <div
        className={clsx(
          'fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-flex-gap-4v fr-mb-4w',
          styles.newsCards,
        )}
      >
        {posts.map((post) => {
          const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url
          const imageAlt = post._embedded?.['wp:featuredmedia']?.[0]?.alt_text || ''
          const excerpt = sanitizeExcerpt(post.excerpt.rendered)

          return (
            <div key={post.id} className={clsx('fr-col-12 fr-col-md-4', styles.newsCardColumn)}>
              {imageUrl ? (
                <Card
                  background
                  border
                  classes={{
                    root: styles.newsCard,
                    body: styles.newsCardBody,
                    content: styles.newsCardContent,
                    desc: styles.newsCardDesc,
                  }}
                  desc={excerpt}
                  enlargeLink
                  imageUrl={imageUrl}
                  imageAlt={imageAlt}
                  linkProps={{
                    href: post.link,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }}
                  size="medium"
                  title={post.title.rendered}
                  titleAs="h3"
                />
              ) : (
                <Card
                  background
                  border
                  classes={{
                    root: styles.newsCard,
                    body: styles.newsCardBody,
                    content: styles.newsCardContent,
                    desc: styles.newsCardDesc,
                  }}
                  desc={excerpt}
                  enlargeLink
                  linkProps={{
                    href: post.link,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }}
                  size="medium"
                  title={post.title.rendered}
                  titleAs="h3"
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="fr-flex fr-justify-content-center fr-mt-4w">
        <Button
          priority="secondary"
          linkProps={{ href: 'https://info.monlogementetudiant.beta.gouv.fr/category/conseils-pratiques/' }}
          iconPosition="right"
          iconId="ri-arrow-right-line"
        >
          {tHome('news.moreButton')}
        </Button>
      </div>
    </section>
  )
}
