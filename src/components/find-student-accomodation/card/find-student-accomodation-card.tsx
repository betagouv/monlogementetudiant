'use client'

import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { Card } from '@codegouvfr/react-dsfr/Card'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { FC } from 'react'
import { SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TooltipHoverOnly } from '~/components/tooltip-hover-only'
import { useWidgetCampaign } from '~/components/widget/widget-campaign-context'
import { trackEvent } from '~/lib/tracking'
import { TUser } from '~/lib/types'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { getAccommodationPath } from '~/utils/get-accommodation-url'
import { appendWidgetCampaign } from '~/utils/widget-campaign'
import styles from './find-student-accomodation-card.module.css'

type AccomodationCardProps = {
  accomodation: TAccomodationCard
  href?: string
  className?: string
  showFavorite?: boolean
  targetBlank?: boolean
  user?: TUser
}

export const AccomodationCard: FC<AccomodationCardProps> = ({
  className,
  accomodation,
  href,
  showFavorite = true,
  targetBlank = false,
  user,
}) => {
  const [selectedAccommodation] = useQueryState('id', parseAsString)
  const widgetCampaign = useWidgetCampaign()
  const t = useTranslations('findAccomodation.card')
  const tA11y = useTranslations('accessibility')
  const { city, imagesUrls, name, nbTotalApartments, postalCode, priceMin, acceptWaitingList } = accomodation
  const nbAvailable = calculateAvailability(accomodation.typologies)
  const nbIndividualApartments = (accomodation.nbTotalApartments || 0) - (accomodation.nbColivingApartments || 0)
  const accommodationsTypes = [
    ...(nbIndividualApartments > 0 ? [t('individual')] : []),
    ...(accomodation.nbColivingApartments ? [t('colocation')] : []),
  ]
  const imageProps =
    imagesUrls && imagesUrls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={imagesUrls[0]} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard id={accomodation.id} />,
        }
  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('noAvailability')} availabilityText={t('availability')} as="span" />
  )

  const showWaitingListBadge = acceptWaitingList && (nbAvailable === null || nbAvailable === undefined || nbAvailable === 0)

  const badgeProps = priceMin
    ? {
        badge: <Badge severity="new" noIcon as="span">{`${t('priceFrom')} ${priceMin}€`}</Badge>,
      }
    : {}

  // Depuis un widget, la carte fait sortir le visiteur de l'iframe vers le site principal : le lien
  // porte la campagne, seul moyen de rattacher ensuite la visite au widget et à son partenaire.
  const redirectUri = appendWidgetCampaign(href ?? getAccommodationPath(city, accomodation.slug), widgetCampaign)

  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        root: clsx(className, selectedAccommodation === accomodation.id.toString() && styles.active, styles.hover),
        header: styles.header,
        start: styles.start,
        endDetail: clsx('fr-justify-content-end', styles.endDetail),
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
      enlargeLink
      linkProps={{
        href: redirectUri,
        onClick: () => trackEvent({ category: 'Logement', action: 'clic carte logement', name: accomodation.slug }),
        ...(targetBlank ? { target: '_blank', rel: 'noopener noreferrer', title: tA11y('linkNewWindow', { label: name }) } : {}),
      }}
      desc={
        <>
          {accommodationsTypes.length > 0 && (
            <span className={clsx('ri-group-line', styles.description)}>{accommodationsTypes.join(' • ')}</span>
          )}
          <br />
          {!!nbTotalApartments && <span className={clsx('ri-community-line', styles.description)}>{`${nbTotalApartments} logements`}</span>}
          {badgeAvailability && <span className={clsx('fr-mt-1v', styles.badgeLine)}>{badgeAvailability}</span>}
          {showWaitingListBadge && (
            <span className={clsx('fr-mt-1v', styles.badgeLine)}>
              <Badge severity="info" small as="span">
                {t('waitingList')}
              </Badge>
            </span>
          )}
          {(nbAvailable === null || nbAvailable === undefined) && (
            <>
              <br />
              <span>
                <TooltipHoverOnly id={`tooltip-availability-${accomodation.id}`} title={t('unknownAvailabilityTooltip')}>
                  <span className={clsx('ri-information-line', styles.description)} />
                </TooltipHoverOnly>
                {t('unknownAvailability')}
              </span>
            </>
          )}
        </>
      }
      start={
        <div className="fr-flex fr-justify-content-space-between">
          <ul className="fr-tags-group">
            <li>
              <Tag nativeButtonProps={{ className: 'fr-cursor-default' }}>{`${city} (${postalCode})`}</Tag>
            </li>
          </ul>
          {showFavorite && <SaveAccommodationFavoriteButton slug={accomodation.slug} user={user} />}
        </div>
      }
      size="small"
      title={<span className="fr-text-title--blue-france fr-mb-0">{name}</span>}
      titleAs="h2"
    />
  )
}
