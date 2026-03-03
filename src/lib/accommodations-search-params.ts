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
