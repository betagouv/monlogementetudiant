'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Pagination } from '@codegouvfr/react-dsfr/Pagination'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

type WidgetAccommodationGridProps = {
  data: TGetAccomodationsResponse
}

export const WidgetAccommodationGrid: FC<WidgetAccommodationGridProps> = ({ data }) => {
  const t = useTranslations('findAccomodation.results')
  const { classes } = useStyles()
  const [queryStates] = useQueryStates({
    bbox: parseAsString,
    page: parseAsInteger,
    prix: parseAsInteger,
    accessible: parseAsString,
    colocation: parseAsString,
    crous: parseAsString,
  })

  const { data: accommodations, isLoading } = useAccomodations({ initialData: data })

  return (
    <div>
      {accommodations && accommodations.count > 0 && (
        <h2 className={fr.cx('fr-mb-2w')} style={{ fontSize: '1.25rem' }}>
          {accommodations.count} logement{accommodations.count > 1 ? 's' : ''}
        </h2>
      )}

      <div className={classes.grid}>
        {!isLoading &&
          (accommodations?.results.features || []).map((accommodation) => (
            <AccomodationCard key={accommodation.id} accomodation={accommodation} showFavorite={false} targetBlank />
          ))}
        {isLoading && Array.from({ length: 12 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>

      {accommodations?.count === 0 && (
        <div className={fr.cx('fr-col-md-11')}>
          <h3>{t('noResult')}</h3>
          <p className={fr.cx('fr-mb-0')}>{t('description')}</p>
          <p>{t('description2')}</p>
        </div>
      )}

      {accommodations && accommodations.count > accommodations.page_size && (
        <div className={classes.paginationContainer}>
          <Pagination
            showFirstLast={false}
            count={Math.ceil(accommodations.count / accommodations.page_size)}
            defaultPage={queryStates.page ?? 1}
            getPageLinkProps={(page: number) => {
              const params = new URLSearchParams()
              if (queryStates.bbox) params.set('bbox', queryStates.bbox)
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
    </div>
  )
}

const useStyles = tss.create({
  grid: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: '1fr',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: '2rem',
    paddingTop: '2rem',
  },
})
