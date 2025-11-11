import { getTranslations } from 'next-intl/server'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './logement.module.css'

export default async function AccommodationDescription({ title, description }: { title: string; description: string | null }) {
  const t = await getTranslations('accomodation')

  if (!description) return null

  return (
    <div className={styles.section}>
      <h4>{t('descriptionTitle', { title })}</h4>
      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(description) }} />
    </div>
  )
}
