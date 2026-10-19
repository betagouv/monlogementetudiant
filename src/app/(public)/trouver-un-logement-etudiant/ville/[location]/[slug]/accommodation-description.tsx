import { getTranslations } from 'next-intl/server'
import { DESCRIPTION_SECTION_KEYS, type TDescriptionSectionKey } from '~/schemas/accommodations/update-residence'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './logement.module.css'

type TAccommodationDescriptionProps = {
  title: string
  tagline: string | null
} & Record<TDescriptionSectionKey, string | null>

export default async function AccommodationDescription({ title, tagline, ...sections }: TAccommodationDescriptionProps) {
  const t = await getTranslations('accomodation')

  const filledSections = DESCRIPTION_SECTION_KEYS.flatMap((key) => {
    const html = sections[key]
    return html ? [{ key, html }] : []
  })
  if (!tagline && filledSections.length === 0) return null

  return (
    <div className={styles.section}>
      <h3 className="fr-h4">{t('descriptionTitle', { title })}</h3>
      <div className="fr-flex fr-direction-column fr-flex-gap-4v">
        {tagline && <p className="fr-text--lead fr-mb-0">{tagline}</p>}
        {filledSections.map(({ key, html }) => (
          <div key={key} className={styles.descriptionSection} dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }} />
        ))}
      </div>
    </div>
  )
}
