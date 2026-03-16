'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { FC, useMemo } from 'react'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TUser } from '~/lib/types'
import { TTerritory } from '~/schemas/territories'
import { FindStudentAccomodationNeighborsResults } from './find-student-accomodation-neighbors-results'
import { FindStudentAccomodationResultsContent } from './find-student-accomodation-results'
import clsx from 'clsx'

type FindStudentAccomodationResultsSectionsProps = {
  isAcademy?: boolean
  showNeighbors?: boolean
  territory?: TTerritory
  user?: TUser
}

export const FindStudentAccomodationResultsSections: FC<FindStudentAccomodationResultsSectionsProps> = ({
  isAcademy,
  showNeighbors,
  territory,
  user,
}) => {
  const { data: accommodations, isFetching } = useAccomodations()
  const mainAccommodationIds = useMemo(
    () => (accommodations?.results.features || []).map((feature) => feature.id),
    [accommodations?.results.features],
  )
  return (
    <>
      <FindStudentAccomodationResultsContent
        territory={territory}
        isAcademy={isAcademy}
        user={user}
        accommodations={accommodations}
        isFetching={isFetching}
      />
      {showNeighbors && (
        <div className={clsx(accommodations && accommodations.count <= accommodations.page_size && 'fr-mt-4w')}>
          <FindStudentAccomodationNeighborsResults territory={territory} user={user} mainAccommodationIds={mainAccommodationIds} />
        </div>
      )}
    </>
  )
}
