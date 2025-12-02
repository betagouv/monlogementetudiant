'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import { FC } from 'react'
import { ResidenceCard } from '~/components/bailleur/residence-card'
import { UpdateResidenceList } from '~/components/bailleur/update-residence-list'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { sPluriel } from '~/utils/sPluriel'

const ResidenceListSkeleton = () => {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'fr-flex fr-direction-md-row fr-direction-column fr-border-top fr-border-left fr-border-right',
            index === 5 && 'fr-border-bottom',
          )}
        >
          <div className="fr-p-md-4w" style={{ minWidth: '384px' }}>
            <div className="skeleton-rectangle" style={{ height: '200px' }} />
          </div>
          <div className="fr-width-full fr-p-4w fr-border-left" style={{ background: 'white' }}>
            <div className="skeleton-rectangle skeleton-rectangle--120" style={{ height: '32px', marginBottom: '16px' }} />
            <div className="fr-grid-row fr-grid-row--gutters">
              <div className="fr-col-6">
                <div className="skeleton-rectangle" style={{ height: '24px', marginBottom: '8px' }} />
                <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px', marginBottom: '16px' }} />
              </div>
              <div className="fr-col-6">
                <div className="skeleton-rectangle" style={{ height: '24px', marginBottom: '8px' }} />
                <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px', marginBottom: '16px' }} />
              </div>
              <div className="fr-col-6">
                <div className="skeleton-rectangle" style={{ height: '24px', marginBottom: '8px' }} />
                <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px', marginBottom: '16px' }} />
              </div>
              <div className="fr-col-6">
                <div className="skeleton-rectangle" style={{ height: '24px', marginBottom: '8px' }} />
                <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px', marginBottom: '16px' }} />
              </div>
              <div className="fr-col-6">
                <div className="skeleton-rectangle" style={{ height: '24px', marginBottom: '8px' }} />
                <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px', marginBottom: '16px' }} />
              </div>
            </div>
            <div className="skeleton-rectangle skeleton-rectangle--200" style={{ height: '40px' }} />
          </div>
        </div>
      ))}
    </>
  )
}

interface ResidenceListProps {
  initialData: TGetAccomodationsResponse
}

export const ResidenceList: FC<ResidenceListProps> = ({ initialData }) => {
  const { data: accommodations, isLoading, isFetching } = useMyAccommodations({ initialData })

  const accommodationsList = accommodations?.results.features || []

  if (isLoading || (isFetching && accommodationsList.length === 0)) {
    return <ResidenceListSkeleton />
  }

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
      {accommodations?.count &&
        accommodationsList.map((accommodation, index) => {
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
                'fr-flex fr-direction-md-row fr-direction-column fr-border-top fr-border-left fr-border-right fr-mb-2w fr-mb-md-0',
                index === accommodationsList.length - 1 && 'fr-border-bottom',
              )}
              key={accommodation.id}
            >
              <div>
                <ResidenceCard key={index} accomodation={accommodation} href={`/bailleur/residences/${accommodation.properties.slug}`} />
              </div>
              <div className="fr-width-full fr-p-4w fr-border-left fr-border-bottom" style={{ background: 'white' }}>
                {badgeAvailability}
                <UpdateResidenceList accommodation={accommodation} />
              </div>
            </div>
          )
        })}
    </>
  )
}
