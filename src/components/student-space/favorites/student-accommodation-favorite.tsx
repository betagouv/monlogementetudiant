'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Card from '@codegouvfr/react-dsfr/Card'
import Tag from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import { SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TooltipHoverOnly } from '~/components/tooltip-hover-only'
import { TUser } from '~/lib/types'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import type { TFavoriteApplicationKind } from '~/server/trpc/routers/favorites'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import { ApplicationStatus } from './application-status'

type StudentAccommodationFavoriteProps = {
  accomodation: TAccomodationCard
  user?: TUser
  /** Candidature déjà déposée sur cette résidence, le cas échéant. */
  application?: TFavoriteApplicationKind | null
}
export const StudentAccommodationFavorite: FC<StudentAccommodationFavoriteProps> = ({ accomodation, user, application }) => {
  const t = useTranslations('findAccomodation.card')
  const tFavorites = useTranslations('student.favorites')
  const { classes } = useStyles()
  const locale = useLocale()
  const { city, citySlug, imagesUrls, name, nbTotalApartments, postalCode, priceMin, published } = accomodation
  const nbAvailable = calculateAvailability(accomodation.typologies)
  const badgeAvailability = (
    <AvailabilityBadge
      nbAvailable={nbAvailable}
      noAvailabilityText={t('noAvailability')}
      availabilityText={(count) => t('availabilityCount', { count })}
      as="span"
    />
  )

  const accommodationsTypes = accomodation.nbColivingApartments ? [t('individual'), t('colocation')] : [t('individual')]
  const imageProps =
    imagesUrls && imagesUrls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={imagesUrls[0]} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard id={accomodation.id} />,
        }

  const badgeProps =
    published && priceMin
      ? {
          badge: <Badge severity="new" noIcon as="span">{`${t('priceFrom')} ${priceMin}€`}</Badge>,
        }
      : {}

  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.slug}`
  const citySearchUri = `/trouver-un-logement-etudiant/ville/${citySlug ?? encodeURIComponent(city)}`
  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        footer: classes.footer,
        header: clsx(classes.header, !published && classes.unpublishedImage),
        root: published ? classes.hover : undefined,
        start: classes.start,
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
      {...(published ? { enlargeLink: true as const, linkProps: { href: redirectUri } } : { enlargeLink: false as const })}
      desc={
        !published ? (
          <>
            <span className="fr-text-mention--grey">{tFavorites('unpublished')}</span>
            <br />
            <Link className="fr-link fr-mt-1w" href={citySearchUri}>
              {tFavorites('unpublishedLink', { cityFormatted: formatCityWithPreposition(locale, 'à', city) })}
            </Link>
          </>
        ) : (
          <>
            <span className={clsx('ri-group-line', classes.description)}>{accommodationsTypes.join(' • ')}</span>
            <br />
            {nbTotalApartments && (
              <span className={clsx('ri-community-line', classes.description)}>
                {tFavorites('accommodationsCount', { count: nbTotalApartments })}
              </span>
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
        )
      }
      start={
        <div className="fr-flex fr-justify-content-space-between">
          <ul className="fr-tags-group">
            <li>
              <Tag>{`${city} (${postalCode})`}</Tag>
            </li>
          </ul>
          <SaveAccommodationFavoriteButton slug={accomodation.slug} user={user} />
        </div>
      }
      footer={application ? <ApplicationStatus kind={application} /> : undefined}
      size="small"
      title={name}
      titleAs="h2"
    />
  )
}

export const useStyles = tss.create({
  start: {
    position: 'relative',
    zIndex: 1,
  },
  footer: {
    paddingLeft: '0 !important',
    paddingRight: '0 !important',
  },
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
  unpublishedImage: {
    filter: 'grayscale(1)',
    opacity: 0.6,
  },
})
