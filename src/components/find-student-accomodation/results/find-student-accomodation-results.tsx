'use client'

import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, Suspense, useEffect, useMemo } from 'react'
import { tss } from 'tss-react'
import { AccomodationCard } from '~/components/find-student-accomodation/card/find-student-accomodation-card'
import { MapSkeleton } from '~/components/map/map-skeleton'
import { Pagination } from '~/components/ui/pagination'
import { CardSkeleton } from '~/components/ui/skeleton/card-skeleton'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { TUser } from '~/lib/types'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { TTerritory } from '~/schemas/territories'

type FindStudentAccomodationResultsProps = {
  territory?: TTerritory
  isAcademy?: boolean
  user?: TUser
}

type FindStudentAccomodationResultsContentProps = FindStudentAccomodationResultsProps & {
  accommodations?: TGetAccomodationsResponse
  isFetching: boolean
}

export const FindStudentAccomodationResults: FC<FindStudentAccomodationResultsProps> = ({ territory, isAcademy, user }) => {
  const { data, isFetching } = useAccomodations()

  return (
    <FindStudentAccomodationResultsContent
      territory={territory}
      isAcademy={isAcademy}
      user={user}
      accommodations={data}
      isFetching={isFetching}
    />
  )
}

export const FindStudentAccomodationResultsContent: FC<FindStudentAccomodationResultsContentProps> = ({
  user,
  accommodations,
  isFetching,
}) => {
  const t = useTranslations('findAccomodation.results')
  const pathname = usePathname()
  const [queryStates] = useQueryStates({
    academie: parseAsString,
    vue: parseAsString,
    page: parseAsInteger,
    bbox: parseAsString,
    prix: parseAsInteger,
    accessible: parseAsBoolean,
    colocation: parseAsBoolean,
    crous: parseAsBoolean,
    disponible: parseAsBoolean,
    ['recherche-par-carte']: parseAsBoolean,
  })

  const isMapSearch = !!queryStates['recherche-par-carte']
  useEffect(() => {
    if (!isMapSearch && accommodations?.results && accommodations.results.length < 6) {
      window.scrollTo({ behavior: 'smooth', top: 0 })
    }
  }, [accommodations?.results.length])

  const hasNoResults = !isFetching && !!accommodations && accommodations.count === 0
  const { classes } = useStyles({ view: queryStates.vue, hasNoResults })

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
      <AccomodationsMap />
    </Suspense>
  )

  return (
    <>
      <div className="fr-hidden-sm">{card}</div>
      <div className={classes.container}>
        <div className={classes.accomodationsContainer}>
          <div className={classes.accommodationGrid} aria-busy={isFetching}>
            {(accommodations?.results || []).map((accommodation) => (
              <AccomodationCard key={accommodation.id} accomodation={accommodation} user={user} />
            ))}
            {!accommodations?.results?.length && isFetching && (
              <div aria-hidden="true" className={classes.accommodationGrid}>
                {Array.from({ length: 24 }).map((_, index) => (
                  <CardSkeleton key={index} />
                ))}
              </div>
            )}
          </div>

          {!isFetching && accommodations?.count === 0 && (
            <div className="fr-col-md-11">
              <h2 className="fr-h3">{t('noResult')}</h2>
              <p className="fr-mb-0">{t('description')}</p>
              <p>{t('description2')}</p>
            </div>
          )}

          {accommodations && accommodations.count > accommodations.pageSize && (
            <div className={classes.paginationContainer}>
              <Pagination
                showFirstLast={false}
                count={Math.ceil(accommodations.count / accommodations.pageSize)}
                defaultPage={queryStates.page ?? 1}
                getPageLinkProps={(page: number) => {
                  const params = new URLSearchParams()
                  if (queryStates.vue) params.set('vue', queryStates.vue)

                  const hasMapInteraction = !!queryStates['recherche-par-carte']
                  if (hasMapInteraction && queryStates.bbox) {
                    params.set('bbox', queryStates.bbox)
                    params.set('recherche-par-carte', 'true')
                  } else if (queryStates.academie) {
                    params.set('academie', queryStates.academie)
                  } else if (queryStates.bbox) {
                    params.set('bbox', queryStates.bbox)
                  }

                  if (queryStates.accessible) {
                    params.set('accessible', 'true')
                  }
                  if (queryStates.colocation) {
                    params.set('colocation', 'true')
                  }
                  if (queryStates.prix) {
                    params.set('prix', queryStates.prix.toString())
                  }
                  if (queryStates.crous) {
                    params.set('crous', 'true')
                  }
                  if (queryStates.disponible) {
                    params.set('disponible', 'true')
                  }
                  params.set('page', page.toString())
                  return {
                    href: `${pathname}?${params.toString()}`,
                    onClick: () => trackEvent({ category: 'Recherche', action: 'pagination', value: page }),
                  }
                }}
              />
            </div>
          )}
        </div>

        {queryStates.vue === 'carte' && <div className={clsx('fr-hidden', 'fr-unhidden-sm', classes.mapContainer)}>{card}</div>}
      </div>
    </>
  )
}

const useStyles = tss.withParams<{ view: string | null; hasNoResults: boolean }>().create(({ view, hasNoResults }) => ({
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
    height: hasNoResults ? '350px' : 'calc(100vh - 20px)',
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
