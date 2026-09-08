import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ConsultOfferButton } from '~/components/find-student-accomodation/owner-details/consult-offer-button'
import { DossierFacileLinkButton } from '~/components/find-student-accomodation/owner-details/dossier-facile-candidate-button'
import { OwnerDetailsActions } from '~/components/find-student-accomodation/owner-details/owner-details-actions'
import { OwnerDetailsAlert } from '~/components/find-student-accomodation/owner-details/owner-details-alert'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { WaitingListBadge } from '~/components/shared/waiting-list-badge'
import { type ApartmentType } from '~/enums/apartment-type'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { formatDayjs } from '~/utils/dayjs'
import styles from './owner-details.module.css'

interface OwnerDetailsProps {
  nbTotalApartments: number | null
  owner: TAccomodationDetails['owner']
  externalUrl: string | undefined
  title: string
  location: string
  nbAvailable: number | null
  acceptWaitingList: boolean
  slug?: string
  isAuthenticated: boolean
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
  contactMode: EOwnerContactMode
  updatedAt: Date
}

export const OwnerDetails = async ({
  nbTotalApartments,
  nbAvailable,
  owner,
  externalUrl,
  title,
  location,
  acceptWaitingList,
  slug,
  isAuthenticated,
  accommodationSlug,
  availableApartmentTypes,
  contactMode,
  updatedAt,
}: OwnerDetailsProps) => {
  const [t, tA11y, locale] = await Promise.all([getTranslations('accomodation'), getTranslations('accessibility'), getLocale()])
  const ownerUrl = externalUrl || owner?.url
  const isDossierFacile = contactMode === EOwnerContactMode.DOSSIER_FACILE
  const badgeAvailability = (
    <AvailabilityBadge
      nbAvailable={nbAvailable}
      noAvailabilityText={t('card.noAvailability')}
      availabilityText={t('card.availability')}
      unknownAvailabilityText={t('unknownAvailability')}
    />
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
        {owner?.imageBase64 ? (
          owner.landingUrl ? (
            <Link
              className="fr-link fr-link--no-underline"
              href={owner.landingUrl}
              target="_blank"
              rel="noreferrer"
              title={tA11y('linkNewWindow', { label: owner.name })}
            >
              <Image className={styles.image} src={owner.imageBase64} alt={owner.name} width={201} height={90} quality={100} />
            </Link>
          ) : (
            <Image className={styles.image} src={owner.imageBase64} alt={owner.name} width={201} height={90} quality={100} />
          )
        ) : (
          <h3 className="fr-m-0">{owner?.name}</h3>
        )}
      </div>
      <div className="fr-flex fr-align-items-center fr-justify-content-center">{badgeAvailability}</div>
      {nbAvailable !== null && (
        <span className="fr-text--xs fr-mb-0">{t('sidebar.updatedAt', { date: formatDayjs(updatedAt, 'DD MMMM YYYY', locale) })}</span>
      )}

      <DossierFacileLinkButton
        accommodationSlug={accommodationSlug}
        availableApartmentTypes={availableApartmentTypes}
        isAuthenticated={isAuthenticated}
        contactMode={contactMode}
      />
      <div className={styles.sidebarOwner}>
        <WaitingListBadge
          acceptWaitingList={acceptWaitingList}
          nbAvailable={nbAvailable}
          waitingListText={t('waitingList')}
          className="fr-mb-1w fr-width-full"
        />
        {!!ownerUrl && (
          <ConsultOfferButton href={ownerUrl} slug={slug ?? ''} priority={!isAuthenticated || !isDossierFacile ? 'primary' : 'tertiary'} />
        )}
      </div>
      {nbAvailable === 0 && (
        <>
          <hr className={styles.sidebarSeparator} />
          <OwnerDetailsAlert isAuthenticated={isAuthenticated} />
        </>
      )}
      <hr className={styles.sidebarSeparator} />
      <OwnerDetailsActions title={title} location={location} />
    </div>
  )
}
