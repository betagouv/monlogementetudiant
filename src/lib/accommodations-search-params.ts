import { createSearchParamsCache, parseAsInteger, parseAsString } from 'nuqs/server'

export const accommodationsParsers = {
  academie: parseAsString,
  accessible: parseAsString,
  bbox: parseAsString,
  colocation: parseAsString,
  gestionnaire: parseAsString,
  page: parseAsInteger,
  prix: parseAsInteger,
  crous: parseAsString,
  ville: parseAsString,
}

export const accommodationsSearchParamsCache = createSearchParamsCache(accommodationsParsers)
