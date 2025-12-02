import { fr } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import styles from './logement.module.css'

type AccommodationLocalisationProps = {
  address: string
  city: string
  latitude: number
  longitude: number
  postalCode: string
}

export const AccommodationLocalisation = async ({ address, city, latitude, longitude, postalCode }: AccommodationLocalisationProps) => {
  const t = await getTranslations('accomodation')
  return (
    <div className={styles.locationContent}>
      <div className={styles.locationInfo}>
        <h4>{t('location.title')}</h4>
        <span>{address}</span>
        <span>
          {postalCode} {city}
        </span>
      </div>
      <div style={{ width: '50%' }} className={fr.cx('fr-hidden', 'fr-unhidden-sm')}>
        <AccommodationMap latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
