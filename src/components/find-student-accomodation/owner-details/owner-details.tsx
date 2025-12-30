import { fr } from '@codegouvfr/react-dsfr'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { OwnerDetailsActions } from '~/components/find-student-accomodation/owner-details/owner-details-actions'
import { OwnerDetailsAlert } from '~/components/find-student-accomodation/owner-details/owner-details-alert'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import styles from './owner-details.module.css'

interface OwnerDetailsProps {
  nbTotalApartments: number | null
  owner: TAccomodationDetails['owner']
  externalUrl: string | undefined
  title: string
  location: string
  available: boolean
  nbAvailable: number | null
  acceptWaitingList: boolean
}

export const OwnerDetails = async ({
  nbTotalApartments,
  nbAvailable,
  available,
  owner,
  externalUrl,
  title,
  location,
  acceptWaitingList,
}: OwnerDetailsProps) => {
  const t = await getTranslations('accomodation')
  const ownerUrl = externalUrl || owner?.url
  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('card.noAvailability')} availabilityText={t('card.availability')} />
  )

  const waitingListBadge = acceptWaitingList && (
    <Badge className={styles.otherBadge} severity="warning" noIcon>
      <span className="fr-text--uppercase fr-mb-0">{t('waitingList')}</span>
    </Badge>
  )

  return (
    <div className={styles.sidebarCard}>
      <div className={clsx(styles.sidebarHeader, 'fr-mb-2w')}>
        {nbTotalApartments ? (
          <h3 className={styles.sidebarTitle}>{t('sidebar.accommodationsCount', { count: nbTotalApartments })}</h3>
        ) : (
          <h3 className={styles.sidebarTitle}>{t('sidebar.accommodationsNoCount')}</h3>
        )}
        <span>{t('sidebar.proposedBy')}</span>
        {owner?.image_base64 ? (
          <Image src={owner.image_base64} alt={owner.name} width={201} height={90} quality={100} />
        ) : (
          <h3 className={fr.cx('fr-m-0')}>{owner?.name}</h3>
        )}
      </div>
      <div className="fr-flex fr-flex-gap-2v fr-direction-column fr-align-items-center fr-justify-content-center">
        {badgeAvailability}
        {waitingListBadge}
      </div>
      {(nbAvailable === null || nbAvailable === undefined) && (
        <>
          <br />
          <span className={clsx('ri-information-line')}>{t('unknownAvailability')}</span>
        </>
      )}
      <div className={styles.sidebarOwner}>
        {!!ownerUrl && available && (
          <>
            <Button linkProps={{ href: ownerUrl }} priority="primary" size="large" className={styles.sidebarOwnerButton}>
              {t('sidebar.buttons.consult')}
            </Button>
            <span> {t('sidebar.buttons.consultDescription')}</span>
          </>
        )}
      </div>
      {nbAvailable === 0 && (
        <>
          <hr className={styles.sidebarSeparator} />
          <OwnerDetailsAlert location={location} />
        </>
      )}
      <hr className={styles.sidebarSeparator} />
      <OwnerDetailsActions title={title} location={location} />
    </div>
  )
}
