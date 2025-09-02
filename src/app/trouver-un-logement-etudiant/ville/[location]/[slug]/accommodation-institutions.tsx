import { getTranslations } from 'next-intl/server'
import { TInstitution } from '~/schemas/institutions/institution'
import styles from './logement.module.css'

export default async function AccommodationInstitutions({ institutions }: { institutions: Array<TInstitution> }) {
  const t = await getTranslations('accomodation.institutions')

  if (!institutions || institutions.length === 0) return null

  return (
    <div className={styles.section}>
      <h4>{t('title', { count: institutions.length })}</h4>
      {institutions.map((i) => (
        <p key={i.id}>{i.properties.name}</p>
      ))}
    </div>
  )
}
