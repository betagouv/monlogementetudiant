// Re-export depuis la lib partagée — toute la logique de géocodage est centralisée dans src/server/lib/import/geocoder.ts

export type { GeoApiCity } from '../../src/server/lib/import/geocoder'
export {
  ensureCity,
  fetchCityByInsee,
  fetchCityFromGeoApi,
  fetchCommunesByDepartment,
  fillCityFromApi,
  geocodeAddress,
  reverseGeocode,
} from '../../src/server/lib/import/geocoder'
