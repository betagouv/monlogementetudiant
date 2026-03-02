'use client'

import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { Card } from '@codegouvfr/react-dsfr/Card'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { FC } from 'react'
import { FAVORITE_BUTTON_TITLES, SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { WaitingListBadge } from '~/components/shared/waiting-list-badge'
import { TooltipHoverOnly } from '~/components/tooltip-hover-only'
import { TUser } from '~/lib/external-auth-plugin'
import { trackEvent } from '~/lib/tracking'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'
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
  const router = useRouter()
  const [selectedAccommodation] = useQueryState('id', parseAsString)
  const t = useTranslations('findAccomodation.card')
  const classes = styles
  const {
    city,
    images_urls,
    name,
    nb_total_apartments,
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
    postal_code,
    price_min,
    accept_waiting_list,
  } = accomodation.properties
  const nbAvailable = calculateAvailability({
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
  })
  const nbIndividualApartments = (accomodation.properties.nb_total_apartments || 0) - (accomodation.properties.nb_coliving_apartments || 0)
  const accommodationsTypes = [
    ...(nbIndividualApartments > 0 ? [t('individual')] : []),
    ...(accomodation.properties.nb_coliving_apartments ? [t('colocation')] : []),
  ]
  const imageProps =
    images_urls && images_urls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={images_urls[0]} name={name} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard id={accomodation.id} />,
        }
  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('noAvailability')} availabilityText={t('availability')} as="span" />
  )

  const waitingListBadge = (
    <WaitingListBadge
      acceptWaitingList={accept_waiting_list}
      nbAvailable={nbAvailable}
      waitingListText={t('waitingList')}
      className={classes.otherBadge}
      as="span"
    />
  )

  const badgeProps = price_min
    ? {
        badge: <Badge severity="new" noIcon as="span">{`${t('priceFrom')} ${price_min}€`}</Badge>,
      }
    : {}

  const redirectUri = href ?? `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.properties.slug}`

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest(`button[title="${FAVORITE_BUTTON_TITLES.ADD}"], button[title="${FAVORITE_BUTTON_TITLES.REMOVE}"]`)) {
      return
    }
    trackEvent({ category: 'Logement', action: 'clic carte logement', name: accomodation.properties.slug })
    if (targetBlank) {
      window.open(redirectUri, '_blank', 'noopener,noreferrer')
    } else {
      router.push(redirectUri)
    }
  }

  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        root: clsx(className, selectedAccommodation === accomodation.id.toString() && classes.active, classes.hover),
        header: classes.header,
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
      nativeDivProps={{ onClick: handleCardClick }}
      desc={
        <>
          {accommodationsTypes.length > 0 && (
            <span className={clsx('ri-group-line', classes.description)}>{accommodationsTypes.join(' • ')}</span>
          )}
          <br />
          {!!nb_total_apartments && (
            <span className={clsx('ri-community-line', classes.description)}>{`${nb_total_apartments} logements`}</span>
          )}
          {!!badgeAvailability && (
            <>
              <br />
              {badgeAvailability}
            </>
          )}
          {(nbAvailable === null || nbAvailable === undefined) && (
            <>
              <br />
              <span>
                <TooltipHoverOnly id={`tooltip-availability-${accomodation.id}`} title={t('unknownAvailabilityTooltip')}>
                  <span className={clsx('ri-information-line', classes.description)} />
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
              <Tag>{`${city} (${postal_code})`}</Tag>
            </li>
          </ul>
          {showFavorite && <SaveAccommodationFavoriteButton slug={accomodation.properties.slug} user={user} />}
        </div>
      }
      end={waitingListBadge}
      size="small"
      title={name}
      titleAs="h2"
    />
  )
}
