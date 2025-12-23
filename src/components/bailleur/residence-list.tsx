'use client'

import clsx from 'clsx'
import { FC } from 'react'
import { ResidenceCard } from '~/components/bailleur/residence-card'
import { UpdateResidenceList } from '~/components/bailleur/update-residence-list'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'

const ResidenceListSkeleton = () => {
  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-6v">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={clsx('fr-flex fr-direction-md-row fr-direction-column fr-border', index === 5 && 'fr-border-bottom')}>
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
    </div>
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
    <div className="fr-flex fr-direction-column fr-flex-gap-6v">
      {accommodations?.count &&
        accommodationsList.map((accommodation, index) => {
          const {
            nb_t1_available,
            nb_t1_bis_available,
            nb_t2_available,
            nb_t3_available,
            nb_t4_available,
            nb_t5_available,
            nb_t6_available,
            nb_t7_more_available,
          } = accommodation.properties
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
            />
          )
          return (
            <div
              className={clsx(
                'fr-flex fr-direction-md-row fr-direction-column fr-mb-2w fr-mb-md-0',
                index === accommodationsList.length - 1 && 'fr-border-bottom',
              )}
              key={accommodation.id}
            >
              <ResidenceCard key={index} accomodation={accommodation} href={`/bailleur/residences/${accommodation.properties.slug}`} />
              <UpdateResidenceList accommodation={accommodation}>{badgeAvailability}</UpdateResidenceList>
            </div>
          )
        })}
    </div>
  )
}
