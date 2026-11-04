import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import { ConsultOfferButton } from '~/components/find-student-accomodation/owner-details/consult-offer-button'
import { DossierFacileLinkButton } from '~/components/find-student-accomodation/owner-details/dossier-facile-candidate-button'
import { OwnerDetailsActions } from '~/components/find-student-accomodation/owner-details/owner-details-actions'
import { OwnerDetailsAlert } from '~/components/find-student-accomodation/owner-details/owner-details-alert'
import { ReportErrorButton } from '~/components/find-student-accomodation/owner-details/report-error-modal'
import { WaitingListBadge } from '~/components/shared/waiting-list-badge'
import { NewWindowHint } from '~/components/ui/new-window'
import { type ApartmentType } from '~/enums/apartment-type'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { TUser } from '~/lib/types'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { acceptsContactRequests } from '~/server/bailleur/applications-open'
import { formatLocalizedDate } from '~/utils/date-helpers'
import { formatFrenchPhoneNumber, toTelHref } from '~/utils/phone-number'
import styles from './owner-details.module.css'

interface OwnerDetailsProps {
  owner: TAccomodationDetails['owner']
  externalUrl: string | undefined
  title: string
  location: string
  nbAvailable: number | null
  acceptWaitingList: boolean
  slug?: string
  isAuthenticated: boolean
  user?: TUser
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
  contactMode: EOwnerContactMode
  updatedAt: Date
  phoneNumber?: string | null
  isCrous: boolean
}

export const OwnerDetails = async ({
  nbAvailable,
  owner,
  externalUrl,
  title,
  location,
  acceptWaitingList,
  slug,
  isAuthenticated,
  user,
  accommodationSlug,
  availableApartmentTypes,
  contactMode,
  updatedAt,
  phoneNumber,
  isCrous,
}: OwnerDetailsProps) => {
  const [t, tA11y, locale] = await Promise.all([getTranslations('accomodation'), getTranslations('accessibility'), getLocale()])
  const ownerUrl = externalUrl || owner?.url
  const isDossierFacile = contactMode === EOwnerContactMode.DOSSIER_FACILE
  const showContactRequest =
    contactMode === EOwnerContactMode.CONTACTS && acceptsContactRequests({ nbAvailableApartments: nbAvailable, acceptWaitingList })
  const consultOfferPriority = showContactRequest ? 'secondary' : !isAuthenticated || !isDossierFacile ? 'primary' : 'tertiary'

  const availabilityTitle =
    nbAvailable === null
      ? t('unknownAvailability')
      : nbAvailable === 0
        ? t('sidebar.noneAvailable')
        : t('sidebar.availableCount', { count: nbAvailable })

  return (
    <div className={styles.sidebarCard}>
      {owner && (
        <div className={clsx(styles.header, 'fr-mb-3w')}>
          {owner.imageBase64 && (
            <Image className={styles.headerLogo} src={owner.imageBase64} alt="" width={120} height={54} quality={100} />
          )}
          <span className="fr-text--sm fr-mb-0">
            {t.rich('sidebar.proposedByManager', {
              managerName: owner.name,
              manager: (chunks) =>
                owner.landingUrl ? (
                  <Link href={owner.landingUrl} target="_blank" rel="noreferrer" title={tA11y('linkNewWindow', { label: owner.name })}>
                    {chunks}
                    <NewWindowHint />
                  </Link>
                ) : (
                  <strong>{chunks}</strong>
                ),
            })}
          </span>
        </div>
      )}
      <h3 className="fr-h6 fr-mb-0 fr-text--center">{availabilityTitle}</h3>
      {nbAvailable !== null && (
        <p className="fr-text--xs fr-mb-0 fr-mt-1w fr-text--center">
          {t('sidebar.updatedAt', { date: formatLocalizedDate(updatedAt, 'dd MMMM yyyy', locale) })}
        </p>
      )}
      <WaitingListBadge
        acceptWaitingList={acceptWaitingList}
        nbAvailable={nbAvailable}
        waitingListText={t('waitingList')}
        className="fr-mt-2w fr-justify-content-center fr-width-full"
      />

      <DossierFacileLinkButton
        accommodationSlug={accommodationSlug}
        availableApartmentTypes={availableApartmentTypes}
        nbAvailable={nbAvailable}
        acceptWaitingList={acceptWaitingList}
        isAuthenticated={isAuthenticated}
        contactMode={contactMode}
      />
      <div className={styles.sidebarOwner}>
        {!!ownerUrl && (
          <ConsultOfferButton
            href={ownerUrl}
            slug={slug ?? ''}
            isCrous={isCrous}
            priority={consultOfferPriority}
            managerName={owner?.name}
          />
        )}
        {!!phoneNumber && (
          <>
            <span className="fr-text--sm fr-mb-0 fr-mt-2w">{t('sidebar.byPhone')}</span>
            <Button
              className={clsx('fr-mt-1w', styles.sidebarOwnerButton)}
              priority="tertiary"
              iconId="ri-phone-line"
              iconPosition="left"
              linkProps={{
                href: toTelHref(phoneNumber),
                title: t('sidebar.buttons.call', { phoneNumber: formatFrenchPhoneNumber(phoneNumber) }),
              }}
            >
              {formatFrenchPhoneNumber(phoneNumber)}
            </Button>
          </>
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
      <div className={styles.footerActions}>
        <div className={styles.footerAction}>
          <SaveAccommodationFavoriteButton slug={accommodationSlug} withLabel user={user} priority="tertiary no outline" />
        </div>
        <div className={styles.footerAction}>
          <ReportErrorButton accommodationSlug={accommodationSlug} variant="action" />
        </div>
      </div>
    </div>
  )
}
