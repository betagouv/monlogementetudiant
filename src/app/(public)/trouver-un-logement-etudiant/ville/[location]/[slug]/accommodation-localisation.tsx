import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import styles from './logement.module.css'

type AddressItem = {
  address: string
  city: string
  postal_code: string
  is_main: boolean
}

type AccommodationLocalisationProps = {
  addresses: AddressItem[]
  positions: [number, number][]
}

export const AccommodationLocalisation = async ({ addresses, positions }: AccommodationLocalisationProps) => {
  const t = await getTranslations('accomodation')

  const sorted = [...addresses].sort((a, b) => Number(b.is_main) - Number(a.is_main))

  return (
    <div className={styles.locationContent}>
      <div className={styles.locationInfo}>
        <h4>{t('location.title')}</h4>
        {sorted.map((a, i) => (
          <div key={`${a.address}-${a.postal_code}-${i}`} className="fr-flex fr-direction-column">
            {a.address && <span>{a.address}</span>}
            <Link
              className="fr-link fr-link--no-underline fr-text--underline"
              href={`/trouver-un-logement-etudiant/ville/${encodeURIComponent(a.city)}`}
            >
              {a.postal_code} {a.city}
            </Link>
          </div>
        ))}
      </div>
      <div style={{ width: '50%' }} className="fr-hidden fr-unhidden-sm">
        <AccommodationMap positions={positions} />
      </div>
    </div>
  )
}
