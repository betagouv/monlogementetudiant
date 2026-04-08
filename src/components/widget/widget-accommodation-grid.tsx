'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Pagination } from '@codegouvfr/react-dsfr/Pagination'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, useEffect } from 'react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { sPluriel } from '~/utils/sPluriel'
import styles from './widget-accommodation-grid.module.css'

type WidgetAccommodationGridProps = {
  cityName?: string
}

export const WidgetAccommodationGrid: FC<WidgetAccommodationGridProps> = () => {
  const t = useTranslations('findAccomodation.results')
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
  })

  const { data: accommodations, isLoading } = useAccomodations({ pageSize: 6 })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const referrer = urlParams.get('referrer') || document.referrer
    if (referrer) {
      trackEvent({ category: 'Widget', action: 'chargement widget', name: referrer })
    }
  }, [])

  return (
    <div>
      {accommodations?.count && (
        <h2 className={clsx('fr-mb-2w', styles.title)}>
          {accommodations.count} résidence{sPluriel(accommodations.count)}
        </h2>
      )}
      <div className={styles.grid}>
        {(accommodations?.results.features || []).map((accommodation) => (
          <AccomodationCard key={accommodation.id} accomodation={accommodation} showFavorite={false} targetBlank />
        ))}
        {!accommodations?.results.features?.length &&
          isLoading &&
          Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
      {!isLoading && accommodations?.count === 0 && (
        <div className={fr.cx('fr-col-md-11')}>
          <h3>{t('noResult')}</h3>
          <p className={fr.cx('fr-mb-0')}>{t('description')}</p>
          <p>{t('description2')}</p>
        </div>
      )}
      {accommodations && accommodations.count > accommodations.page_size && (
        <div className={styles.paginationContainer}>
          <Pagination
            showFirstLast={false}
            count={Math.ceil(accommodations.count / accommodations.page_size)}
            defaultPage={queryStates.page ?? 1}
            getPageLinkProps={(page: number) => {
              const params = new URLSearchParams()
              if (queryStates.bbox) params.set('bbox', queryStates.bbox)
              if (queryStates.city) params.set('city', queryStates.city)
              if (queryStates.accessible) params.set('accessible', queryStates.accessible)
              if (queryStates.colocation) params.set('colocation', queryStates.colocation)
              if (queryStates.prix) params.set('prix', queryStates.prix.toString())
              if (queryStates.crous) params.set('crous', queryStates.crous.toString())
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
      <footer className={styles.footer}>
        Proposé par{' '}
        <a
          href="https://monlogementetudiant.beta.gouv.fr"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent({ category: 'Widget', action: 'clic vers site principal' })}
        >
          MonLogementEtudiant.beta.gouv.fr
        </a>
      </footer>
    </div>
  )
}
