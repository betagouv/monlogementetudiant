'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Card from '@codegouvfr/react-dsfr/Card'
import Tag from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'
import { sPluriel } from '~/utils/sPluriel'

type StudentAccommodationFavoriteProps = {
  accomodation: TAccomodationCard
}
export const StudentAccommodationFavorite: FC<StudentAccommodationFavoriteProps> = ({ accomodation }) => {
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
    nb_t4_more_available,
    postal_code,
    price_min,
  } = accomodation.properties
  const availabilityValues = [nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available]
  const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
  const nbAvailable = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null
  const accommodationsTypes = accomodation.properties.nb_coliving_apartments ? [t('individual'), t('colocation')] : [t('individual')]
  const imageProps =
    images_urls && images_urls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={images_urls[0]} name={name} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard />,
        }
  const badgeAvailability =
    nbAvailable !== null && nbAvailable !== undefined ? (
      nbAvailable === 0 ? (
        <Badge severity="error" noIcon as="span">
          <span className="fr-text--uppercase fr-mb-0">{t('noAvailability')}</span>
        </Badge>
      ) : (
        <Badge severity="success" noIcon as="span">
          {nbAvailable}&nbsp;
          <span className="fr-text--uppercase fr-mb-0">
            {t('availability')}
            {sPluriel(nbAvailable)}
          </span>
        </Badge>
      )
    ) : null

  const badgeProps = price_min
    ? {
        badge: <Badge severity="new" noIcon as="span">{`${t('priceFrom')} ${price_min}€`}</Badge>,
      }
    : {}

  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.properties.slug}`
  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        header: classes.header,
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
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
      enlargeLink
      linkProps={{
        href: redirectUri,
      }}
      start={
        <ul className="fr-tags-group">
          <li>
            <Tag>{`${city} (${postal_code})`}</Tag>
          </li>
        </ul>
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
