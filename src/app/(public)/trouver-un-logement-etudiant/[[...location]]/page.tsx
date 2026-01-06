export const dynamic = 'force-dynamic'

import { fr } from '@codegouvfr/react-dsfr'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FindStudentAccommodationTitle } from '~/components/find-student-accomodation/header/find-student-accommodation-title'
import { FindStudentAccomodationHeader } from '~/components/find-student-accomodation/header/find-student-accomodation-header'
import FindStudentAccommodationQA from '~/components/find-student-accomodation/qa/find-student-accommodation-qa'
import { FindStudentAccomodationResults } from '~/components/find-student-accomodation/results/find-student-accomodation-results'
import { FindStudentAccomodationSortView } from '~/components/find-student-accomodation/sort-view/find-student-accomodation-sort-view'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories } from '~/schemas/territories'
import { getAccommodations } from '~/server-only/get-accommodations'
import { getTerritories } from '~/server-only/get-territories'

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

  return {}
}

export default async function FindStudentAccommodationPage({
  params,
  searchParams,
}: {
  params: Promise<{ location: string }>
  searchParams: Promise<{
    accessible: string
    academie?: string
    prix?: string
    bbox?: string
    content_type?: string
    colocation?: string
    object_id?: string
    page?: string
    crous?: string
  }>
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
    (territory) => territory.name === routeLocation,
  )
  if (routeCategoryKey && routeLocation && !territory) {
    redirect(`/trouver-un-logement-etudiant`)
  }
  const territoryBbox = territory?.bbox
    ? expandBbox(territory.bbox.xmin, territory.bbox.ymin, territory.bbox.xmax, territory.bbox.ymax)
    : undefined

  // do not use bbox while fetching if user searching by academy
  const isAcademy = routeCategoryKey === 'academie'
  const accommodationsParams = {
    ...awaitedSearchParams,
    ...(isAcademy && territory ? { academie: territory.id.toString() } : {}),
    ...(!isAcademy && territoryBbox
      ? { bbox: `${territoryBbox.west},${territoryBbox.south},${territoryBbox.east},${territoryBbox.north}` }
      : {}),
  }
  const accommodations = await getAccommodations(accommodationsParams)

  return (
    <>
      <div className={fr.cx('fr-container')}>
        <FindStudentAccommodationTitle location={territory?.name} />
        <FindStudentAccomodationHeader />
        <FindStudentAccomodationSortView data={accommodations} territory={territory} />
        <FindStudentAccomodationResults data={accommodations} territory={territory} isAcademy={isAcademy} />
      </div>
      <FindStudentAccommodationQA />
    </>
  )
}
