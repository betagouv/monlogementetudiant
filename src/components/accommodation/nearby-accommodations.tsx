'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import Card, { CardProps } from '@codegouvfr/react-dsfr/Card'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { tss } from 'tss-react'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const NearbyAccommodations = ({
  nearbyAccommodations,
  accommodation,
}: { nearbyAccommodations: TGetAccomodationsResponse; accommodation: TAccomodationDetails }) => {
  const { classes } = useStyles()
  const t = useTranslations('accomodation')
  const [currentIndex, setCurrentIndex] = useState(0)
  const nearbyFeatures = nearbyAccommodations.results.features.filter((feature) => feature.id !== accommodation.id)
  const maxIndex = nearbyFeatures.length - 1
  const handlePrevious = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex))
  const handleNext = () => setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0))
  const currentFeature = nearbyFeatures[currentIndex]?.properties
  const hasImage = !!currentFeature?.images_urls?.[0]
  const nbTotalApartments = currentFeature?.nb_total_apartments

  const cardProps = {
    background: true,
    border: true,
    badge: currentFeature.price_min ? <Badge severity="new" noIcon>{`${currentFeature.price_min}€`}</Badge> : undefined,
    desc: <>{nbTotalApartments && <span className={fr.cx('ri-community-line')}>{`${nbTotalApartments} logements`}</span>}</>,
    enlargeLink: true,
    horizontal: true,
    ...(hasImage
      ? {
          imageAlt: `Image de la résidence ${currentFeature?.name}`,
          imageUrl: currentFeature?.images_urls?.[0] ?? '',
        }
      : {}),
    linkProps: {
      href: `/trouver-un-logement-etudiant/ville/${encodeURIComponent(currentFeature.city)}/${currentFeature.slug}`,
    },
    size: 'small' as const,
    title: currentFeature?.name,
    titleAs: 'h5' as const,
  } as CardProps & (typeof hasImage extends true ? CardProps.WithImageLink : CardProps.WithoutImage)

  return (
    <>
      <div className={classes.nearbySection}>
        <p className={classes.nearbyTitle}>{t('nearby.title')}</p>
        <div className={classes.buttonGroup}>
          <Button
            size="small"
            onClick={handlePrevious}
            iconId="ri-arrow-left-s-line"
            priority="tertiary"
            title={t('nearby.buttons.previous')}
          />
          <Button size="small" onClick={handleNext} iconId="ri-arrow-right-s-line" priority="tertiary" title={t('nearby.buttons.next')} />
        </div>
      </div>
      <div>{nearbyFeatures.length > 0 && <Card {...cardProps} />}</div>
    </>
  )
}

const useStyles = tss.create({
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
  },
  nearbySection: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    margin: '1rem 0',
  },
  nearbyTitle: {
    margin: 0,
  },
})
