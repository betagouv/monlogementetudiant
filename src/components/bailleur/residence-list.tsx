'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import { FC } from 'react'
import { tss } from 'tss-react'
import { UpdateResidenceList } from '~/components/bailleur/update-residence-list'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { sPluriel } from '~/utils/sPluriel'

interface ResidenceListProps {
  initialData: TGetAccomodationsResponse
}

export const ResidenceList: FC<ResidenceListProps> = ({ initialData }) => {
  const { classes } = useStyles()
  const { data: accommodations } = useMyAccommodations({ initialData })

  const accommodationsList = accommodations?.results.features || []

  if (accommodationsList.length === 0) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-py-8w">
        <h3>Aucune résidence trouvée</h3>
        <p>Aucune résidence ne correspond à vos critères de recherche.</p>
      </div>
    )
  }

  return (
    <>
      {accommodationsList.map((accommodation, index) => {
        const { nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available } = accommodation.properties
        const availabilityValues = [nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available]
        const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
        const nbAvailable = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null

        const badgeAvailability =
          nbAvailable !== null && nbAvailable !== undefined ? (
            nbAvailable === 0 ? (
              <Badge severity="error" noIcon>
                <span className="fr-text--uppercase fr-mb-0">Disponibilité non communiquée</span>
              </Badge>
            ) : (
              <Badge severity="success" noIcon>
                {nbAvailable}&nbsp;
                <span className="fr-text--uppercase fr-mb-0">
                  DISPONIBILITÉ
                  {sPluriel(nbAvailable)}
                </span>
              </Badge>
            )
          ) : null
        return (
          <div
            className={clsx(
              'fr-flex fr-direction-md-row fr-direction-column fr-border-top fr-border-left fr-border-right',
              index === accommodationsList.length - 1 && 'fr-border-bottom',
            )}
            key={accommodation.id}
          >
            <div className="fr-p-md-4w">
              <AccomodationCard
                key={index}
                accomodation={accommodation}
                href={`/bailleur/residences/${accommodation.properties.slug}`}
                className={classes.container}
              />
            </div>
            <div className="fr-width-full fr-p-4w fr-border-left" style={{ background: 'white' }}>
              {badgeAvailability}
              <UpdateResidenceList accommodation={accommodation} />
            </div>
          </div>
        )
      })}
    </>
  )
}

export const useStyles = tss.create({
  container: {
    minWidth: '384px',
  },
})
