'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Pagination } from '@codegouvfr/react-dsfr/Pagination'
import clsx from 'clsx'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, Suspense, useEffect, useMemo } from 'react'
import { tss } from 'tss-react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { MapSkeleton } from '~/components/map/map-skeleton'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { TTerritory } from '~/schemas/territories'

type FindStudentAccomodationResultsProps = {
  data: TGetAccomodationsResponse
  territory?: TTerritory
  isAcademy?: boolean
  serverBbox?: string
}
export const FindStudentAccomodationResults: FC<FindStudentAccomodationResultsProps> = ({ data, territory, isAcademy, serverBbox }) => {
  const t = useTranslations('findAccomodation.results')
  const [queryStates, setQueryStates] = useQueryStates({
    academie: parseAsString,
    vue: parseAsString,
    page: parseAsInteger,
    bbox: parseAsString,
    prix: parseAsInteger,
    accessible: parseAsString,
    colocation: parseAsString,
    crous: parseAsString,
    ['recherche-par-carte']: parseAsString,
  })

  useEffect(() => {
    if (serverBbox && !queryStates.bbox) {
      setQueryStates({ bbox: serverBbox })
    }
  }, [])

  const { data: accommodations, isFetching } = useAccomodations({ initialData: data })

  useEffect(() => {
    if (!!accommodations?.results?.features && accommodations.results.features.length < 6) {
      window.scrollTo({ behavior: 'smooth', top: 0 })
    }
  }, [accommodations?.results.features.length])

  const { classes } = useStyles({ view: queryStates.vue })

  const AccomodationsMap = useMemo(
    () =>
      dynamic(() => import('~/components/map/accomodations-map').then((mod) => mod.AccomodationsMap), {
        loading: () => <MapSkeleton height={700} />,
        ssr: false,
      }),
    [],
  )

  const card = (
    <Suspense fallback={<MapSkeleton height={700} />}>
      <AccomodationsMap data={data} />
    </Suspense>
  )
  return (
    <>
      <div className={fr.cx('fr-hidden-sm')}>{card}</div>
      <div className={classes.container}>
        <div className={classes.accomodationsContainer}>
          <div className={classes.accommodationGrid}>
            {(accommodations?.results.features || []).map((accommodation) => (
              <AccomodationCard key={accommodation.id} accomodation={accommodation} />
            ))}
            {!accommodations?.results.features?.length &&
              isFetching &&
              Array.from({ length: 24 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>

          {!isFetching && accommodations?.count === 0 && (
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
                  if (queryStates.vue) params.set('vue', queryStates.vue)

                  const hasMapInteraction = queryStates['recherche-par-carte'] === 'true'
                  if (hasMapInteraction && queryStates.bbox) {
                    params.set('bbox', queryStates.bbox)
                    params.set('recherche-par-carte', 'true')
                  } else if (queryStates.academie) {
                    params.set('academie', queryStates.academie)
                  } else if (queryStates.bbox) {
                    params.set('bbox', queryStates.bbox)
                  }

                  if (queryStates.accessible) {
                    params.set('accessible', queryStates.accessible)
                  }
                  if (queryStates.colocation) {
                    params.set('colocation', queryStates.colocation)
                  }
                  if (queryStates.prix) {
                    params.set('prix', queryStates.prix.toString())
                  }
                  if (queryStates.crous) {
                    params.set('crous', queryStates.crous.toString())
                  }
                  params.set('page', page.toString())
                  return {
                    href: `/trouver-un-logement-etudiant?${params.toString()}`,
                    onClick: () => trackEvent({ category: 'Recherche', action: 'pagination', value: page }),
                  }
                }}
              />
            </div>
          )}
        </div>

        {queryStates.vue === 'carte' && <div className={clsx(fr.cx('fr-hidden', 'fr-unhidden-sm'), classes.mapContainer)}>{card}</div>}
      </div>
    </>
  )
}

const useStyles = tss.withParams<{ view: string | null }>().create(({ view }) => ({
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    },
  },
  accommodationGrid: {
    [fr.breakpoints.up('md')]: {
      gridTemplateColumns: view === 'carte' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
    },
    display: 'grid',
    gap: '1rem',
  },
  accomodationsContainer: {
    [fr.breakpoints.up('md')]: {
      flex: view === 'carte' ? '0 0 60%' : '0 0 100%',
      marginBottom: '2rem',
      maxWidth: view === 'carte' ? '60%' : '100%',
      width: view === 'carte' ? '60%' : '100%',
    },
  },
  cardWidth: {
    [fr.breakpoints.up('md')]: {
      maxWidth: view === 'carte' ? '333px' : '400px',
      width: '100%',
    },
  },
  container: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
  },
  mapContainer: {
    width: '100%',
    height: 'calc(100vh - 20px)',
    minHeight: '300px',
    position: 'sticky',
    top: '1rem',
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: '2rem',
    paddingTop: '2rem',
  },
}))
