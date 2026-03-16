'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { useTRPC } from '~/server/trpc/client'

interface UseMyAccommodationsOptions {
  debounceTime?: number
}

export const useMyAccommodations = ({ debounceTime = 300 }: UseMyAccommodationsOptions = {}) => {
  const trpc = useTRPC()
  const [queryStates] = useQueryStates({
    page: parseAsInteger,
    disponible: parseAsBoolean,
    recherche: parseAsString,
  })

  const { page, disponible, recherche } = queryStates
  const [debouncedRecherche] = useDebounce(recherche, debounceTime)

  const enabled =
    page !== null || disponible !== null || debouncedRecherche === null || debouncedRecherche.length === 0 || debouncedRecherche.length >= 3

  return useQuery(
    trpc.bailleur.list.queryOptions(
      {
        page: page ?? 1,
        hasAvailability: disponible ?? undefined,
        search: debouncedRecherche && debouncedRecherche.length >= 3 ? debouncedRecherche : undefined,
      },
      { enabled, placeholderData: keepPreviousData },
    ),
  )
}
