import { fr } from '@codegouvfr/react-dsfr'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { OwnerDetailsActions } from '~/components/find-student-accomodation/owner-details/owner-details-actions'
import { OwnerDetailsAlert } from '~/components/find-student-accomodation/owner-details/owner-details-alert'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { sPluriel } from '~/utils/sPluriel'
import styles from './owner-details.module.css'

interface OwnerDetailsProps {
  nbTotalApartments: number | null
  owner: TAccomodationDetails['owner']
  externalUrl: string | undefined
  title: string
  location: string
  available: boolean
  nbAvailable: number | null
}

export const OwnerDetails = async ({
  nbTotalApartments,
  nbAvailable,
  available,
  owner,
  externalUrl,
  title,
  location,
}: OwnerDetailsProps) => {
  const t = await getTranslations('accomodation')
  const ownerUrl = externalUrl || owner?.url
  let badgeAvailability = null
  if (!!nbAvailable && nbAvailable > 0) {
    badgeAvailability = (
      <Badge severity="success" noIcon>
        {nbAvailable} DISPONIBLE{sPluriel(nbAvailable)}
      </Badge>
    )
  }
  if (nbAvailable === 0) {
    badgeAvailability = (
      <Badge severity="error" noIcon>
        AUCUNE DISPONIBILITÉ
      </Badge>
    )
  }

  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarHeader}>
        {nbTotalApartments ? (
          <h3 className={styles.sidebarTitle}>{t('sidebar.accommodationsCount', { count: nbTotalApartments })}</h3>
        ) : (
          <h3 className={styles.sidebarTitle}>{t('sidebar.accommodationsNoCount')}</h3>
        )}
        {badgeAvailability}
        <span>{t('sidebar.proposedBy')}</span>
        {owner?.image_base64 ? (
          <Image src={owner.image_base64} alt={owner.name} width={201} height={90} quality={100} />
        ) : (
          <h3 className={fr.cx('fr-m-0')}>{owner?.name}</h3>
        )}
      </div>
      <div className={styles.sidebarOwner}>
        {!!ownerUrl && available && (
          <>
            <span className={fr.cx('fr-text--sm', 'fr-m-0')}>{t('sidebar.hasAvailableAccommodation')}</span>
            <Button linkProps={{ href: ownerUrl }} priority="primary" size="large" className={styles.sidebarOwnerButton}>
              {t('sidebar.buttons.consult')}
            </Button>
          </>
        )}
      </div>
      <hr className={styles.sidebarSeparator} />
      <OwnerDetailsAlert location={location} />
      <hr className={styles.sidebarSeparator} />
      <OwnerDetailsActions title={title} location={location} />
    </div>
  )
}
