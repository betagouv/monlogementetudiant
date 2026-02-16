'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Pagination } from '@codegouvfr/react-dsfr/Pagination'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { formatCityWithA } from '~/utils/french-contraction'
import styles from './widget-accommodation-grid.module.css'

type WidgetAccommodationGridProps = {
  data: TGetAccomodationsResponse
  cityName?: string
}

export const WidgetAccommodationGrid: FC<WidgetAccommodationGridProps> = ({ data, cityName }) => {
  const t = useTranslations('findAccomodation.results')
  const [queryStates] = useQueryStates({
    bbox: parseAsString,
    city: parseAsString,
    page: parseAsInteger,
    prix: parseAsInteger,
    accessible: parseAsString,
    colocation: parseAsString,
    crous: parseAsString,
  })

  const { data: accommodations, isLoading } = useAccomodations({ initialData: data, pageSize: 6 })

  return (
    <div>
      <h2 className={`${fr.cx('fr-mb-2w')} ${styles.title}`}>Trouver un logement {cityName ? formatCityWithA(cityName) : 'étudiant'}</h2>

      <div className={styles.grid}>
        {!isLoading &&
          (accommodations?.results.features || []).map((accommodation) => (
            <AccomodationCard key={accommodation.id} accomodation={accommodation} showFavorite={false} targetBlank />
          ))}
        {isLoading && Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>

      {accommodations?.count === 0 && (
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
              params.set('page', page.toString())
              return { href: `/widget/logements?${params.toString()}` }
            }}
          />
        </div>
      )}

      <footer className={styles.footer}>
        Proposé par{' '}
        <a href="https://monlogementetudiant.beta.gouv.fr" target="_blank" rel="noopener noreferrer">
          MonLogementEtudiant.beta.gouv.fr
        </a>
      </footer>
    </div>
  )
}
