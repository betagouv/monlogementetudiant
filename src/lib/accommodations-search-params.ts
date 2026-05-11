import { createSearchParamsCache, parseAsBoolean, parseAsInteger, parseAsString } from 'nuqs/server'

export const accommodationsParsers = {
  academie: parseAsString,
  accessible: parseAsBoolean,
  bbox: parseAsString,
  colocation: parseAsBoolean,
  disponible: parseAsBoolean,
  gestionnaire: parseAsString,
  page: parseAsInteger,
  prix: parseAsInteger,
  crous: parseAsBoolean,
}

export const accommodationsSearchParamsCache = createSearchParamsCache(accommodationsParsers)
