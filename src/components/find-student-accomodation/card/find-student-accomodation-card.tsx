'use client'

import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { Card } from '@codegouvfr/react-dsfr/Card'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { FAVORITE_BUTTON_TITLES, SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'

type AccomodationCardProps = {
  accomodation: TAccomodationCard
  href?: string
  className?: string
  showFavorite?: boolean
  targetBlank?: boolean
}

export const AccomodationCard: FC<AccomodationCardProps> = ({
  className,
  accomodation,
  href,
  showFavorite = true,
  targetBlank = false,
}) => {
  const router = useRouter()
  const [selectedAccommodation] = useQueryState('id', parseAsString)
  const t = useTranslations('findAccomodation.card')
  const { classes } = useStyles()
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
          imageComponent: <FindStudentAccommodationPlaceholderImageCard />,
        }
  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('noAvailability')} availabilityText={t('availability')} as="span" />
  )

  const waitingListBadge = accept_waiting_list && (
    <Badge className={classes.otherBadge} severity="warning" noIcon as="span">
      <span className="fr-text--uppercase fr-mb-0">{t('waitingList')}</span>
    </Badge>
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
              <span className={clsx('ri-information-line', classes.description)}>{t('unknownAvailability')}</span>
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
          {showFavorite && <SaveAccommodationFavoriteButton slug={accomodation.properties.slug} />}
        </div>
      }
      end={<>{waitingListBadge}</>}
      size="small"
      title={name}
      titleAs="h2"
    />
  )
}

export const useStyles = tss.create({
  header: {
    overflow: 'hidden',
  },
  hover: {
    '&:hover': {
      cursor: 'pointer',
    },
  },
  active: {
    border: '2px solid #3B7FF6',
  },
  otherBadge: {
    backgroundColor: '#fee7fc',
    color: '#6e445a',
  },
  description: {
    color: '#666666',
  },
})
