'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, useMemo } from 'react'
import { tss } from 'tss-react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM, computeExpandedPriceMax } from '~/lib/accommodations-expanded-search'
import { TUser } from '~/lib/types'
import { TTerritory } from '~/schemas/territories'
import { useTRPC } from '~/server/trpc/client'

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
  const { classes } = useStyles()

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
    }),
    enabled: !!cityName,
  })

  const mainAccommodationIdSet = useMemo(() => new Set(mainAccommodationIds), [mainAccommodationIds])

  const expandedFeatures = useMemo(
    () => (expandedAccommodations?.results.features || []).filter((feature) => !mainAccommodationIdSet.has(feature.id)),
    [expandedAccommodations?.results.features, mainAccommodationIdSet],
  )

  if (!cityName) {
    return null
  }

  return (
    <section className={classes.section}>
      <h2 className={fr.cx('fr-h4', 'fr-mb-1w')}>{t('expandedTitle')}</h2>
      <p className={fr.cx('fr-text--sm', 'fr-mb-3w')}>{t('expandedDescription')}</p>

      <div className={classes.grid}>
        {expandedFeatures.map((accommodation) => (
          <AccomodationCard key={accommodation.id} accomodation={accommodation} user={user} />
        ))}
        {!expandedFeatures.length && isFetching && Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>

      {!isFetching && expandedFeatures.length === 0 && <p className={fr.cx('fr-mb-0')}>{t('expandedNoResult')}</p>}
    </section>
  )
}

const useStyles = tss.create({
  grid: {
    display: 'grid',
    gap: '1rem',
    [fr.breakpoints.up('md')]: {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
  section: {
    marginBottom: '2rem',
    marginTop: '2rem',
  },
})
