/**
 * Generic snake_case → camelCase field mapper.
 *
 * A `FieldMap` is a plain object whose keys are snake_case input field names
 * and whose values are the corresponding camelCase DB column names.
 *
 * `mapFields` iterates over the map and copies every value that is not
 * `undefined` from `input` into the result under its camelCase key.
 * This preserves the existing behaviour where `undefined` means "not provided"
 * and should be omitted from the DB update payload.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps snake_case input keys to camelCase DB column names. */
export type FieldMap = Record<string, string>

// ---------------------------------------------------------------------------
// Field‑map definitions
// ---------------------------------------------------------------------------

/** Fields used by ZUpdateResidenceList (availability only). */
export const AVAILABILITY_FIELD_MAP: FieldMap = {
  nb_t1_available: 'nbT1Available',
  nb_t1_bis_available: 'nbT1BisAvailable',
  nb_t2_available: 'nbT2Available',
  nb_t3_available: 'nbT3Available',
  nb_t4_available: 'nbT4Available',
  nb_t5_available: 'nbT5Available',
  nb_t6_available: 'nbT6Available',
  nb_t7_more_available: 'nbT7MoreAvailable',
} as const

/** Fields used by ZUpdateResidence (full update). */
export const UPDATE_FIELD_MAP: FieldMap = {
  // Core fields
  name: 'name',
  residence_type: 'residenceType',
  target_audience: 'target_audience',
  address: 'address',
  city: 'city',
  postal_code: 'postalCode',
  description: 'description',
  external_url: 'externalUrl',
  accept_waiting_list: 'acceptWaitingList',
  published: 'published',
  scholarship_holders_priority: 'scholarshipHoldersPriority',
  images_urls: 'imagesUrls',

  // Typology counts
  nb_t1: 'nbT1',
  nb_t1_bis: 'nbT1Bis',
  nb_t2: 'nbT2',
  nb_t3: 'nbT3',
  nb_t4: 'nbT4',
  nb_t5: 'nbT5',
  nb_t6: 'nbT6',
  nb_t7_more: 'nbT7More',

  // Availability
  ...AVAILABILITY_FIELD_MAP,

  // Pricing
  price_min_t1: 'priceMinT1',
  price_max_t1: 'priceMaxT1',
  price_min_t1_bis: 'priceMinT1Bis',
  price_max_t1_bis: 'priceMaxT1Bis',
  price_min_t2: 'priceMinT2',
  price_max_t2: 'priceMaxT2',
  price_min_t3: 'priceMinT3',
  price_max_t3: 'priceMaxT3',
  price_min_t4: 'priceMinT4',
  price_max_t4: 'priceMaxT4',
  price_min_t5: 'priceMinT5',
  price_max_t5: 'priceMaxT5',
  price_min_t6: 'priceMinT6',
  price_max_t6: 'priceMaxT6',
  price_min_t7_more: 'priceMinT7More',
  price_max_t7_more: 'priceMaxT7More',

  // Superficie (m²)
  superficie_min_t1: 'superficieMinT1',
  superficie_max_t1: 'superficieMaxT1',
  superficie_min_t1_bis: 'superficieMinT1Bis',
  superficie_max_t1_bis: 'superficieMaxT1Bis',
  superficie_min_t2: 'superficieMinT2',
  superficie_max_t2: 'superficieMaxT2',
  superficie_min_t3: 'superficieMinT3',
  superficie_max_t3: 'superficieMaxT3',
  superficie_min_t4: 'superficieMinT4',
  superficie_max_t4: 'superficieMaxT4',
  superficie_min_t5: 'superficieMinT5',
  superficie_max_t5: 'superficieMaxT5',
  superficie_min_t6: 'superficieMinT6',
  superficie_max_t6: 'superficieMaxT6',
  superficie_min_t7_more: 'superficieMinT7More',
  superficie_max_t7_more: 'superficieMaxT7More',

  // Misc counts
  nb_accessible_apartments: 'nbAccessibleApartments',
  nb_coliving_apartments: 'nbColivingApartments',

  // Amenities
  refrigerator: 'refrigerator',
  laundry_room: 'laundryRoom',
  bathroom: 'bathroom',
  kitchen_type: 'kitchenType',
  microwave: 'microwave',
  secure_access: 'secureAccess',
  parking: 'parking',
  common_areas: 'commonAreas',
  bike_storage: 'bikeStorage',
  desk: 'desk',
  residence_manager: 'residenceManager',
  cooking_plates: 'cookingPlates',
} as const

// ---------------------------------------------------------------------------
// Mapper function
// ---------------------------------------------------------------------------

/**
 * Map an input object through a field map, skipping `undefined` values.
 *
 * @param input  - The snake_case input (e.g. from a Zod-parsed tRPC input).
 * @param fieldMap - A mapping of snake_case keys → camelCase keys.
 * @returns A new object with only the defined fields, keyed in camelCase.
 */
export function mapFields(input: Record<string, unknown>, fieldMap: FieldMap): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [snakeKey, camelKey] of Object.entries(fieldMap)) {
    const value = input[snakeKey]
    if (value !== undefined) {
      result[camelKey] = value
    }
  }
  return result
}
