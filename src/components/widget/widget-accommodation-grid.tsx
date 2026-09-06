'use client'

import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, useMemo } from 'react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { FindStudentAccomodationNeighborsResults } from '~/components/find-student-accomodation/results/find-student-accomodation-neighbors-results'
import { NewWindowHint } from '~/components/ui/new-window'
import { Pagination } from '~/components/ui/pagination'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useWidgetCampaign } from '~/components/widget/widget-campaign-context'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { TTerritory } from '~/schemas/territories'
import { useTRPC } from '~/server/trpc/client'
import { sPluriel } from '~/utils/sPluriel'
import { appendWidgetCampaign } from '~/utils/widget-campaign'
import styles from './widget-accommodation-grid.module.css'

type WidgetAccommodationGridProps = {
  territory?: TTerritory
}

export const WidgetAccommodationGrid: FC<WidgetAccommodationGridProps> = ({ territory }) => {
  const t = useTranslations('findAccomodation.results')
  const trpc = useTRPC()
  const [queryStates] = useQueryStates({
    bbox: parseAsString,
    city: parseAsString,
    filters: parseAsString,
    gestionnaire: parseAsString,
    page: parseAsInteger,
    prix: parseAsInteger,
    accessible: parseAsString,
    colocation: parseAsString,
    crous: parseAsString,
    disponible: parseAsString,
  })

  const queryCitySlug = queryStates.city ?? undefined
  const shouldResolveQueryCity = !territory && !!queryCitySlug
  const { data: queryCity } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({
      type: 'ville' as const,
      slug: queryCitySlug!,
    }),
    enabled: shouldResolveQueryCity,
  })
  const effectiveTerritory = territory ?? queryCity
  const effectiveCitySlug =
    effectiveTerritory && 'slug' in effectiveTerritory && typeof effectiveTerritory.slug === 'string'
      ? effectiveTerritory.slug
      : queryCitySlug
  const { data: accommodations, isLoading } = useAccomodations({
    cityId: effectiveTerritory?.id,
    citySlug: effectiveCitySlug,
    pageSize: 6,
  })

  const totalPages = accommodations ? Math.ceil(accommodations.count / accommodations.pageSize) : 1
  const currentPage = queryStates.page ?? 1
  const isLastPage = currentPage >= totalPages
  const widgetCampaign = useWidgetCampaign()
  const mainAccommodationIds = useMemo(() => (accommodations?.results || []).map((feature) => feature.id), [accommodations?.results])

  return (
    <div>
      {accommodations?.count && (
        <h2 className={clsx('fr-mb-2w', styles.title)}>
          {accommodations.count} résidence{sPluriel(accommodations.count)}
        </h2>
      )}
      <div className={styles.grid}>
        {(accommodations?.results || []).map((accommodation) => (
          <AccomodationCard key={accommodation.id} accomodation={accommodation} showFavorite={false} targetBlank />
        ))}
        {!accommodations?.results?.length && isLoading && Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
      {!isLoading && accommodations?.count === 0 && (
        <div className="fr-col-md-11">
          <h3>{t('noResult')}</h3>
          <p className="fr-mb-0">{t('description')}</p>
          <p>{t('description2')}</p>
        </div>
      )}
      {accommodations && accommodations.count > accommodations.pageSize && (
        <div className={styles.paginationContainer}>
          <Pagination
            showFirstLast={false}
            count={totalPages}
            defaultPage={currentPage}
            getPageLinkProps={(page: number) => {
              const params = new URLSearchParams()
              if (queryStates.bbox) params.set('bbox', queryStates.bbox)
              if (queryStates.city) params.set('city', queryStates.city)
              if (queryStates.accessible) params.set('accessible', queryStates.accessible)
              if (queryStates.colocation) params.set('colocation', queryStates.colocation)
              if (queryStates.prix) params.set('prix', queryStates.prix.toString())
              if (queryStates.crous) params.set('crous', queryStates.crous.toString())
              if (queryStates.disponible) params.set('disponible', queryStates.disponible)
              if (queryStates.gestionnaire) params.set('gestionnaire', queryStates.gestionnaire)
              if (queryStates.filters) params.set('filters', queryStates.filters)
              params.set('page', page.toString())
              return {
                href: `/widget/logements?${params.toString()}`,
                onClick: () => {
                  trackEvent({ category: 'Widget', action: 'pagination widget', value: page })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                },
              }
            }}
          />
        </div>
      )}
      {effectiveTerritory && isLastPage && (
        <div className={clsx(accommodations && accommodations.count <= accommodations.pageSize && 'fr-mt-4w')}>
          <FindStudentAccomodationNeighborsResults
            territory={effectiveTerritory}
            mainAccommodationIds={mainAccommodationIds}
            showFavorite={false}
            targetBlank
          />
        </div>
      )}
      <footer className={styles.footer}>
        Proposé par{' '}
        <a
          href={appendWidgetCampaign('https://monlogementetudiant.beta.gouv.fr', widgetCampaign)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent({ category: 'Widget', action: 'clic vers site principal' })}
        >
          MonLogementEtudiant.beta.gouv.fr
          <NewWindowHint />
        </a>
      </footer>
    </div>
  )
}
