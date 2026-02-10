'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Card from '@codegouvfr/react-dsfr/Card'
import Tag from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

type StudentAccommodationFavoriteProps = {
  accomodation: TAccomodationCard
}
export const StudentAccommodationFavorite: FC<StudentAccommodationFavoriteProps> = ({ accomodation }) => {
  const t = useTranslations('findAccomodation.card')
  const router = useRouter()
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
  const badgeAvailability = (
    <AvailabilityBadge
      nbAvailable={nbAvailable}
      noAvailabilityText="Disponibilité non communiquée"
      availabilityText="DISPONIBILITÉ"
      as="span"
    />
  )

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest(`button[title="${FAVORITE_BUTTON_TITLES.ADD}"], button[title="${FAVORITE_BUTTON_TITLES.REMOVE}"]`)) {
      return
    }
    router.push(redirectUri)
  }

  const accommodationsTypes = accomodation.properties.nb_coliving_apartments ? [t('individual'), t('colocation')] : [t('individual')]
  const imageProps =
    images_urls && images_urls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={images_urls[0]} name={name} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard />,
        }

  const badgeProps = price_min
    ? {
        badge: <Badge severity="new" noIcon as="span">{`${t('priceFrom')} ${price_min}€`}</Badge>,
      }
    : {}

  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.properties.slug}`

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleCardClick(event as unknown as React.MouseEvent)
  }

  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        header: classes.header,
        root: classes.hover,
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
      nativeDivProps={{ onClick: handleCardClick, onKeyDown: handleCardKeyDown, role: 'link', tabIndex: 0 }}
      desc={
        <>
          <span className={clsx('ri-group-line', classes.description)}>{accommodationsTypes.join(' • ')}</span>
          <br />
          {nb_total_apartments && (
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
          <SaveAccommodationFavoriteButton slug={accomodation.properties.slug} />
        </div>
      }
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
  description: {
    color: '#666666',
  },
})
