import { createSearchParamsCache, parseAsInteger, parseAsString } from 'nuqs/server'

export const accommodationsParsers = {
  academie: parseAsString,
  accessible: parseAsString,
  bbox: parseAsString,
  colocation: parseAsString,
  page: parseAsInteger,
  prix: parseAsInteger,
  crous: parseAsString,
}

export const accommodationsSearchParamsCache = createSearchParamsCache(accommodationsParsers)

export const accommodationsQueryKey = (params: {
  academie: string | null
  accessible: string | null
  bbox: string | null
  colocation: string | null
  page: number | null
  prix: number | null
  crous: string | null
  pageSize?: number
}) => ['accomodations', { ...params }] as const
