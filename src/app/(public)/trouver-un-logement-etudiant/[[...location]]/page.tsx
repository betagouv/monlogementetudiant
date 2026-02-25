export const dynamic = 'force-dynamic'

import { fr } from '@codegouvfr/react-dsfr'
import { HydrationBoundary } from '@tanstack/react-query'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FindStudentAccommodationBanner } from '~/components/find-student-accomodation/find-student-accommodation-banner'
import { FindStudentAccommodationTitle } from '~/components/find-student-accomodation/header/find-student-accommodation-title'
import { FindStudentAccomodationHeader } from '~/components/find-student-accomodation/header/find-student-accomodation-header'
import FindStudentAccommodationQA from '~/components/find-student-accomodation/qa/find-student-accommodation-qa'
import { FindStudentAccomodationResults } from '~/components/find-student-accomodation/results/find-student-accomodation-results'
import { FindStudentAccomodationSortView } from '~/components/find-student-accomodation/sort-view/find-student-accomodation-sort-view'
import { expandBbox } from '~/components/map/map-utils'
import { SearchParamsSync } from '~/components/search-params-sync'
import { TTerritories } from '~/schemas/territories'
import { prefetchAccommodations } from '~/server-only/get-accommodations'
import { getTerritories } from '~/server-only/get-territories'
import { formatCityWithA } from '~/utils/french-contraction'

const getTerritoriesCategoryKey = (categoryKey: 'ville' | 'academie' | 'departement') => {
  const keys = {
    academie: 'academies',
    departement: 'departments',
    ville: 'cities',
  }
  return keys[categoryKey] as keyof TTerritories
}

export async function generateMetadata({ params }: { params: Promise<{ location: string }> }): Promise<Metadata> {
  const awaitedParams = await params
  const routeCategoryKey = awaitedParams?.location?.[0] || ''

  if (routeCategoryKey === 'academie') {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const t = await getTranslations('metadata')

  if ((routeCategoryKey === 'ville' || routeCategoryKey === 'departement') && awaitedParams?.location?.[1]) {
    const routeLocation = decodeURIComponent(awaitedParams.location[1])
    const territories = await getTerritories(routeLocation)
    const territory = (territories[getTerritoriesCategoryKey(routeCategoryKey)] || []).find(
      (territory) => territory.name === routeLocation || territory.slug === routeLocation,
    )

    if (territory) {
      const locationFormatted = formatCityWithA(territory.name)
      return {
        title: t('searchDetails.title', { locationFormatted }),
        description: t('searchDetails.description', { locationFormatted }),
      }
    }
  }

  return {
    title: t('search.title'),
    description: t('search.description'),
  }
}

export default async function FindStudentAccommodationPage({
  params,
  searchParams,
}: {
  params: Promise<{ location: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const awaitedParams = await params
  const awaitedSearchParams = await searchParams
  const routeCategoryKey = awaitedParams?.location?.[0] || ''
  const routeLocation = decodeURIComponent(awaitedParams?.location?.[1] || '')
  if (awaitedParams && (awaitedParams?.location?.length < 2 || awaitedParams?.location?.length > 2)) {
    redirect(`/trouver-un-logement-etudiant`)
  }

  const territories = await getTerritories(routeLocation)
  const territory = (territories[getTerritoriesCategoryKey(routeCategoryKey as 'ville' | 'academie' | 'departement')] || []).find(
    (territory) => territory.name === routeLocation || territory.slug === routeLocation,
  )
  if (routeCategoryKey && routeLocation && !territory) {
    redirect(`/trouver-un-logement-etudiant`)
  }
  const territoryBbox = territory?.bbox
    ? expandBbox(territory.bbox.xmin, territory.bbox.ymin, territory.bbox.xmax, territory.bbox.ymax)
    : undefined

  const isAcademy = routeCategoryKey === 'academie'

  const serverBbox =
    !isAcademy && territoryBbox ? `${territoryBbox.west},${territoryBbox.south},${territoryBbox.east},${territoryBbox.north}` : undefined
  const serverAcademie = isAcademy && territory ? territory.id.toString() : undefined

  const dehydratedState = await prefetchAccommodations(awaitedSearchParams, {
    bbox: serverBbox,
    academie: serverAcademie,
  })

  return (
    <HydrationBoundary state={dehydratedState}>
      <SearchParamsSync bbox={serverBbox} academie={serverAcademie} />
      <div className={fr.cx('fr-container')}>
        <FindStudentAccommodationTitle location={territory?.name} />
        <FindStudentAccomodationHeader />
        <FindStudentAccomodationSortView territory={territory} />
        {!!territory && <FindStudentAccommodationBanner territory={territory} categoryKey={routeCategoryKey} />}
        <FindStudentAccomodationResults territory={territory} isAcademy={isAcademy} />
      </div>
      <FindStudentAccommodationQA />
    </HydrationBoundary>
  )
}
