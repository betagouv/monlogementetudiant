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
  const { classes } = useStyles()
  const { city, images_urls, name, nb_total_apartments, postal_code, published } = accomodation.properties
  const accommodationsTypes = accomodation.properties.nb_coliving_apartments ? [t('individual'), t('colocation')] : [t('individual')]
  const imageProps =
    images_urls && images_urls.length > 0
      ? { imageComponent: <FindStudentAccommodationImageCard image={images_urls[0]} name={name} /> }
      : {
          imageComponent: <FindStudentAccommodationPlaceholderImageCard />,
        }

  const badgeProps = published
    ? {
        badge: (
          <Badge severity="success" noIcon as="span">
            Publiée
          </Badge>
        ),
      }
    : {
        badge: (
          <Badge severity="error" noIcon as="span">
            Dépubliée
          </Badge>
        ),
      }

  const redirectUri = href ?? `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accomodation.properties.slug}`
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
          {nb_total_apartments && (
            <span className={clsx('ri-community-line', classes.description)}>{`${nb_total_apartments} logements`}</span>
          )}
        </>
      }
      footer={
        <Button priority="secondary" iconId="ri-pencil-line" linkProps={{ href: redirectUri }}>
          Éditer la résidence
        </Button>
      }
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
