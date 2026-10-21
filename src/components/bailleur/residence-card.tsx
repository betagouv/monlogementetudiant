'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { type ButtonProps } from '@codegouvfr/react-dsfr/Button'
import ButtonsGroup from '@codegouvfr/react-dsfr/ButtonsGroup'
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
  contactsHref?: string
}

export const ResidenceCard: FC<ResidenceCardProps> = ({ accomodation, href, contactsHref }) => {
  const t = useTranslations('findAccomodation.card')
  const tList = useTranslations('bailleur.residences')
  const tA11y = useTranslations('accessibility')
  const { classes } = useStyles()
  const { city, citySlug, imagesUrls, name, nbTotalApartments, postalCode, published } = accomodation
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

  const editUri = href ?? `/bailleur/residences/${accomodation.slug}`
  const publicUri = citySlug ? `/trouver-un-logement-etudiant/ville/${citySlug}/${accomodation.slug}` : null

  const footerButtons: [ButtonProps, ...ButtonProps[]] = [
    {
      children: tList('list.editResidence'),
      priority: 'secondary',
      iconId: 'ri-pencil-line',
      linkProps: { href: editUri },
    },
  ]
  if (contactsHref) {
    footerButtons.push({
      children: tList('list.contacts'),
      priority: 'secondary',
      iconId: 'ri-contacts-book-2-line',
      linkProps: { href: contactsHref },
    })
  }

  return (
    <Card
      {...badgeProps}
      {...imageProps}
      classes={{
        root: classes.root,
        header: classes.header,
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
      footer={<ButtonsGroup inlineLayoutWhen="always" buttonsSize="small" buttons={footerButtons} />}
      start={
        <ul className="fr-tags-group">
          <li>
            <Tag>{`${city} (${postalCode})`}</Tag>
          </li>
        </ul>
      }
      {...(published && publicUri
        ? {
            linkProps: {
              href: publicUri,
              target: '_blank',
              title: tA11y('linkNewWindow', { label: tList('list.viewResidenceNamed', { name }) }),
            },
          }
        : {})}
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
