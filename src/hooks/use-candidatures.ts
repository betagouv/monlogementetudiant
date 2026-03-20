'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { useTRPC } from '~/server/trpc/client'

export const useCandidatures = () => {
  const trpc = useTRPC()
  const [queryStates] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    status: parseAsStringLiteral(['pending', 'accepted', 'rejected']),
    recherche: parseAsString.withDefault(''),
    tri: parseAsStringLiteral(['date_desc', 'date_asc']).withDefault('date_desc'),
  })

  const [debouncedRecherche] = useDebounce(queryStates.recherche, 300)

  return {
    queryStates,
    ...useQuery(
      trpc.bailleur.listCandidatures.queryOptions(
        {
          page: queryStates.page,
          status: queryStates.status || undefined,
          search: debouncedRecherche && debouncedRecherche.length >= 2 ? debouncedRecherche : undefined,
          sort: queryStates.tri || 'date_desc',
        },
        { placeholderData: keepPreviousData },
      ),
    ),
  }
}
