export const dynamic = 'force-dynamic'

import { HydrationBoundary } from '@tanstack/react-query'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FindStudentAccommodationBanner } from '~/components/find-student-accomodation/find-student-accommodation-banner'
import { FindStudentAccommodationTitle } from '~/components/find-student-accomodation/header/find-student-accommodation-title'
import { FindStudentAccomodationHeader } from '~/components/find-student-accomodation/header/find-student-accomodation-header'
import FindStudentAccommodationQA from '~/components/find-student-accomodation/qa/find-student-accommodation-qa'
import { FindStudentAccomodationResultsSections } from '~/components/find-student-accomodation/results/find-student-accomodation-results-sections'
import { FindStudentAccomodationSortView } from '~/components/find-student-accomodation/sort-view/find-student-accomodation-sort-view'
import { SearchParamsSync } from '~/components/search-params-sync'
import { getCanonicalUrl } from '~/utils/canonical'
import { formatCityWithA } from '~/utils/french-contraction'
import { getStudentAccommodationPageContext } from './get-student-accommodation-page-context'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ location: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const awaitedParams = await params
  const awaitedSearchParams = await searchParams
  const { routeCategoryKey, territory } = await getStudentAccommodationPageContext(awaitedParams, awaitedSearchParams)

  const routeLocation = awaitedParams?.location?.[1] ? decodeURIComponent(awaitedParams.location[1]) : undefined
  const canonicalPath = routeCategoryKey && routeLocation ? `/${routeCategoryKey}/${routeLocation}` : ''
  const canonical = getCanonicalUrl(`/trouver-un-logement-etudiant${canonicalPath}`)

  if (routeCategoryKey === 'academie') {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const t = await getTranslations('metadata')

  if (territory) {
    const locationFormatted = formatCityWithA(territory.name)
    return {
      title: t('searchDetails.title', { locationFormatted }),
      description: t('searchDetails.description', { locationFormatted }),
      alternates: { canonical },
    }
  }

  return {
    title: t('search.title'),
    description: t('search.description'),
    alternates: { canonical },
  }
}

export default async function FindStudentAccommodationPage({
  params,
  searchParams,
}: {
  params: Promise<{ location: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const awaitedParams = await params
  const awaitedSearchParams = await searchParams
  const { dehydratedState, user, territory, isAcademy, serverBbox, serverAcademie, routeCategoryKey } =
    await getStudentAccommodationPageContext(awaitedParams, awaitedSearchParams)

  return (
    <HydrationBoundary state={dehydratedState}>
      <SearchParamsSync bbox={serverBbox} academie={serverAcademie} />
      <div className="fr-container">
        <FindStudentAccommodationTitle location={territory?.name} />
        <FindStudentAccomodationHeader />
        <FindStudentAccomodationSortView territory={territory} />
        {!!territory && <FindStudentAccommodationBanner territory={territory} categoryKey={routeCategoryKey} />}
        <FindStudentAccomodationResultsSections
          territory={territory}
          isAcademy={isAcademy}
          user={user}
          showNeighbors={routeCategoryKey === 'ville'}
        />
      </div>
      <FindStudentAccommodationQA />
    </HydrationBoundary>
  )
}
