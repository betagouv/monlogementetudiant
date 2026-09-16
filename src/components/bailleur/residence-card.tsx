'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Badge } from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { Card } from '@codegouvfr/react-dsfr/Card'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import {
  FindStudentAccommodationImageCard,
  FindStudentAccommodationPlaceholderImageCard,
} from '~/components/find-student-accomodation/card/find-student-accommodation-image-card'
import { TAccomodationCard } from '~/schemas/accommodations/accommodations'

type ResidenceCardProps = {
  accomodation: TAccomodationCard
  href?: string
}

export const ResidenceCard: FC<ResidenceCardProps> = ({ accomodation, href }) => {
  const t = useTranslations('findAccomodation.card')
  const tList = useTranslations('bailleur.residences')
  const { classes } = useStyles()
  const { city, imagesUrls, name, nbTotalApartments, postalCode, published } = accomodation
  const accommodationsTypes = accomodation.nbColivingApartments ? [t('individual'), t('colocation')] : [t('individual')]
  const imageProps =
    imagesUrls && imagesUrls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={imagesUrls[0]} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard id={accomodation.id} />,
        }

  const badgeProps = published
    ? {
        badge: (
          <Badge severity="success" noIcon as="span">
            {tList('details.published')}
          </Badge>
        ),
      }
    : {
        badge: (
          <Badge severity="error" noIcon as="span">
            {tList('details.unpublished')}
          </Badge>
        ),
      }

  const redirectUri = href ?? `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.slug}`
  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        root: classes.root,
        header: classes.header,
        footer: 'fr-flex fr-justify-content-end',
      }}
      id={`accomodation-${accomodation.id}`}
      background
      border
      desc={
        <>
          <span className={clsx('ri-group-line', classes.description)}>{accommodationsTypes.join(' • ')}</span>
          <br />
          {nbTotalApartments && (
            <span className={clsx('ri-community-line', classes.description)}>
              {tList('list.housingCount', { count: nbTotalApartments })}
            </span>
          )}
        </>
      }
      footer={
        <Button size="small" priority="secondary" iconId="ri-pencil-line" linkProps={{ href: redirectUri }}>
          {tList('list.editResidence')}
        </Button>
      }
      start={
        <ul className="fr-tags-group">
          <li>
            <Tag>{`${city} (${postalCode})`}</Tag>
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
  root: {
    [fr.breakpoints.up('md')]: {
      minWidth: '384px',
    },
    backgroundImage: 'none',
  },
  description: {
    color: '#666666',
  },
})
