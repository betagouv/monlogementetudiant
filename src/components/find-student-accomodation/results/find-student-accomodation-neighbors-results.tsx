'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { computeExpandedPriceMax, EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { TUser } from '~/lib/types'
import { TTerritory } from '~/schemas/territories'
import { useTRPC } from '~/server/trpc/client'
import { formatCityWithDe } from '~/utils/french-contraction'
import styles from './find-student-accomodation-neighbors-results.module.css'

type FindStudentAccomodationNeighborsResultsProps = {
  mainAccommodationIds: number[]
  territory?: TTerritory
  user?: TUser
}

export const FindStudentAccomodationNeighborsResults: FC<FindStudentAccomodationNeighborsResultsProps> = ({
  territory,
  user,
  mainAccommodationIds,
}) => {
  const t = useTranslations('findAccomodation.results')
  const trpc = useTRPC()
  const [queryStates] = useQueryStates({
    prix: parseAsInteger,
    accessible: parseAsString,
    colocation: parseAsString,
    crous: parseAsString,
    gestionnaire: parseAsString,
  })

  const cityName = 'name' in (territory || {}) ? territory?.name : undefined
  const expandedPriceMax = computeExpandedPriceMax(queryStates.prix)

  const { data: expandedAccommodations, isFetching } = useQuery({
    ...trpc.accommodations.listExpandedByCity.queryOptions({
      city: cityName ?? '',
      radius: EXPANDED_SEARCH_RADIUS_KM,
      page: 1,
      pageSize: EXPANDED_SEARCH_PAGE_SIZE,
      isAccessible: queryStates.accessible === 'true' ? true : undefined,
      hasColiving: queryStates.colocation === 'true' ? true : undefined,
      viewCrous: queryStates.crous === 'true',
      ownerSlug: queryStates.gestionnaire ?? undefined,
      priceMax: expandedPriceMax,
      excludeIds: mainAccommodationIds,
    }),
    enabled: !!cityName,
  })

  const expandedFeatures = expandedAccommodations?.results.features || []
  const showLoadingState = !expandedAccommodations

  if (!cityName || (!showLoadingState && !isFetching && expandedFeatures.length === 0)) {
    return null
  }

  return (
    <section className={styles.section}>
      <h2 className="fr-h4 fr-mb-1w">{t('expandedTitle', { city: formatCityWithDe(cityName) })}</h2>
      <p className="fr-text--sm fr-mb-3w">{t('expandedDescription')}</p>

      <div className={styles.grid}>
        {expandedFeatures.map((accommodation) => (
          <AccomodationCard key={accommodation.id} accomodation={accommodation} user={user} />
        ))}
        {showLoadingState && Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
    </section>
  )
}
