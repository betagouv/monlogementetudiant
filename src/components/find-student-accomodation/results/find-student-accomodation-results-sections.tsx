'use client'

import clsx from 'clsx'
import { parseAsInteger, useQueryState } from 'nuqs'
import { FC, useMemo } from 'react'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TUser } from '~/lib/types'
import { TTerritory } from '~/schemas/territories'
import { FindStudentAccomodationNeighborsResults } from './find-student-accomodation-neighbors-results'
import { FindStudentAccomodationResultsContent } from './find-student-accomodation-results'

type FindStudentAccomodationResultsSectionsProps = {
  categoryKey?: string
  isAcademy?: boolean
  showNeighbors?: boolean
  territory?: TTerritory
  user?: TUser
}

export const FindStudentAccomodationResultsSections: FC<FindStudentAccomodationResultsSectionsProps> = ({
  categoryKey,
  isAcademy,
  showNeighbors,
  territory,
  user,
}) => {
  const { data: accommodations, isFetching } = useAccomodations()
  const [page] = useQueryState('page', parseAsInteger.withDefault(1))
  const totalPages = accommodations ? Math.ceil(accommodations.count / accommodations.pageSize) : 1
  const isLastPage = page >= totalPages
  const mainAccommodationIds = useMemo(() => (accommodations?.results || []).map((feature) => feature.id), [accommodations?.results])
  return (
    <>
      <FindStudentAccomodationResultsContent
        territory={territory}
        categoryKey={categoryKey}
        isAcademy={isAcademy}
        user={user}
        accommodations={accommodations}
        isFetching={isFetching}
      />
      {showNeighbors && isLastPage && (
        <div className={clsx(accommodations && accommodations.count <= accommodations.pageSize && 'fr-mt-4w')}>
          <FindStudentAccomodationNeighborsResults territory={territory} user={user} mainAccommodationIds={mainAccommodationIds} />
        </div>
      )}
    </>
  )
}
