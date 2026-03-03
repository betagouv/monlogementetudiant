import Link from 'next/link'
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
  const encodedCity = encodeURIComponent(city)
  return (
    <div className={styles.locationContent}>
      <div className={styles.locationInfo}>
        <h4>{t('location.title')}</h4>
        <span>{address}</span>
        <Link className="fr-link fr-link--no-underline fr-text--underline" href={`/trouver-un-logement-etudiant/ville/${encodedCity}`}>
          {postalCode} {city}
        </Link>
      </div>
      <div style={{ width: '50%' }} className="fr-hidden fr-unhidden-sm">
        <AccommodationMap latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
