export const dynamic = 'force-dynamic'

import { fr } from '@codegouvfr/react-dsfr'
import { redirect } from 'next/navigation'
import { FindStudentAccommodationTitle } from '~/components/find-student-accomodation/header/find-student-accommodation-title'
import { FindStudentAccomodationHeader } from '~/components/find-student-accomodation/header/find-student-accomodation-header'
import FindStudentAccommodationQA from '~/components/find-student-accomodation/qa/find-student-accommodation-qa'
import { FindStudentAccomodationResults } from '~/components/find-student-accomodation/results/find-student-accomodation-results'
import { FindStudentAccomodationSortView } from '~/components/find-student-accomodation/sort-view/find-student-accomodation-sort-view'
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

// const getQACategoryKey = (categoryKey: 'ville' | 'academie' | 'departement') => {
//   const keys = {
//     academie: 'academy',
//     departement: 'department',
//     ville: 'city',
//   }
//   return keys[categoryKey]
// }

export default async function FindStudentAccommodationPage({
  params,
  searchParams,
}: {
  params: { location: string }
  searchParams: {
    accessible: string
    prix?: string
    bbox?: string
    content_type?: string
    colocation?: string
    object_id?: string
    page?: string
  }
}) {
  const routeCategoryKey = params?.location?.[0] || ''
  const routeLocation = decodeURIComponent(params?.location?.[1] || '')
  if (params && (params?.location?.length < 2 || params?.location?.length > 2)) {
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
    ? `${territory.bbox.xmin},${territory.bbox.ymin},${territory.bbox.xmax},${territory.bbox.ymax}`
    : undefined
  const accommodations = await getAccommodations({ ...searchParams, bbox: territoryBbox })
  // const qa = await getTerritoryQuestionsAnswers({
  //   content_type: getQACategoryKey(routeCategoryKey as 'ville' | 'academie' | 'departement'),
  //   object_id: territory?.id,
  // })

  return (
    <>
      <div className={fr.cx('fr-container')}>
        <FindStudentAccommodationTitle location={territory?.name} />
        <FindStudentAccomodationHeader />
        <FindStudentAccomodationSortView data={accommodations} territory={territory} />
        <FindStudentAccomodationResults data={accommodations} territory={territory} />
      </div>
      <FindStudentAccommodationQA />
    </>
  )
}
