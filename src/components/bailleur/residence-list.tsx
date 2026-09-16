'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { ResidenceCard } from '~/components/bailleur/residence-card'
import { UpdateResidenceList } from '~/components/bailleur/update-residence-list'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { Pagination } from '~/components/ui/pagination'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { buildHref } from '~/utils/preserve-query-params'

const ResidenceListSkeleton = () => (
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

export const ResidenceList: FC = () => {
  const t = useTranslations('findAccomodation.card')
  const tList = useTranslations('bailleur.residences.list')
  const { data: accommodations, isLoading } = useMyAccommodations()
  const [queryStates] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    disponible: parseAsBoolean.withDefault(false),
    recherche: parseAsString.withDefault(''),
    ownerId: parseAsInteger,
  })

  const accommodationsList = accommodations?.results || []

  if (isLoading) {
    return <ResidenceListSkeleton />
  }

  if (accommodationsList.length === 0) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-py-8w">
        <h3>{tList('emptyTitle')}</h3>
        <p>{tList('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="fr-flex fr-direction-column fr-flex-gap-6v">
        {accommodations?.count &&
          accommodationsList.map((accommodation, index) => {
            const nbAvailable = calculateAvailability(accommodation.typologies)

            const badgeAvailability = (
              <AvailabilityBadge
                nbAvailable={nbAvailable}
                noAvailabilityText={t('noAvailability')}
                availabilityText={(count) => t('availabilityCount', { count })}
                unknownAvailabilityText={t('unknownAvailability')}
                context="owner"
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
                <ResidenceCard
                  key={index}
                  accomodation={accommodation}
                  href={buildHref(`/bailleur/residences/${accommodation.slug}`, { ownerId: queryStates.ownerId?.toString() })}
                />
                <UpdateResidenceList accommodation={accommodation}>
                  <div className="fr-flex fr-justify-content-space-between">
                    {!!accommodation.nbTotalApartments && (
                      <span className="fr-text-mention--grey fr-text--xl fr-mb-0">
                        {tList('housingCount', { count: accommodation.nbTotalApartments })}
                      </span>
                    )}
                    {badgeAvailability}
                  </div>
                  <hr className="fr-mt-3w fr-mb-0" />
                </UpdateResidenceList>
              </div>
            )
          })}
      </div>
      {accommodations && accommodations.count > accommodations.pageSize && (
        <Pagination
          showFirstLast={false}
          count={Math.ceil(accommodations.count / accommodations.pageSize)}
          defaultPage={queryStates.page ?? 1}
          className="fr-flex fr-justify-content-center fr-align-items-center fr-py-2w"
          getPageLinkProps={(page: number) => {
            const params = new URLSearchParams()
            if (queryStates.disponible) params.set('disponible', queryStates.disponible.toString())
            if (queryStates.recherche) params.set('recherche', queryStates.recherche)
            if (queryStates.ownerId) params.set('ownerId', queryStates.ownerId.toString())
            params.set('page', page.toString())
            return { href: `/bailleur/residences?${params.toString()}` }
          }}
        />
      )}
    </>
  )
}
