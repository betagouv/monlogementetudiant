export const dynamic = 'force-dynamic'

import { HydrationBoundary } from '@tanstack/react-query'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FindStudentAccommodationBanner } from '~/components/find-student-accomodation/find-student-accommodation-banner'
import { FindStudentAccommodationTitle } from '~/components/find-student-accomodation/header/find-student-accommodation-title'
import { FindStudentAccomodationHeader } from '~/components/find-student-accomodation/header/find-student-accomodation-header'
import FindStudentAccommodationQA from '~/components/find-student-accomodation/qa/find-student-accommodation-qa'
import { FindStudentAccomodationNeighborsResults } from '~/components/find-student-accomodation/results/find-student-accomodation-neighbors-results'
import { FindStudentAccomodationResults } from '~/components/find-student-accomodation/results/find-student-accomodation-results'
import { FindStudentAccomodationSortView } from '~/components/find-student-accomodation/sort-view/find-student-accomodation-sort-view'
import { SearchParamsSync } from '~/components/search-params-sync'
import { formatCityWithA } from '~/utils/french-contraction'
import { getStudentAccommodationPageContext } from './get-student-accommodation-page-context'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ location: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { routeCategoryKey, territory } = await getStudentAccommodationPageContext(await params, await searchParams)

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
  const { dehydratedState, user, territory, isAcademy, serverBbox, serverAcademie, routeCategoryKey } =
    await getStudentAccommodationPageContext(await params, await searchParams)

  return (
    <HydrationBoundary state={dehydratedState}>
      <SearchParamsSync bbox={serverBbox} academie={serverAcademie} />
      <div className="fr-container">
        <FindStudentAccommodationTitle location={territory?.name} />
        <FindStudentAccomodationHeader />
        <FindStudentAccomodationSortView territory={territory} />
        {!!territory && <FindStudentAccommodationBanner territory={territory} categoryKey={routeCategoryKey} />}
        <FindStudentAccomodationResults territory={territory} isAcademy={isAcademy} user={user} />
        {routeCategoryKey === 'ville' && <FindStudentAccomodationNeighborsResults territory={territory} user={user} />}
      </div>
      <FindStudentAccommodationQA />
    </HydrationBoundary>
  )
}
