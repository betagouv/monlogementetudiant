export interface AvailabilityProperties {
  nb_t1_available: number | null
  nb_t1_bis_available: number | null
  nb_t2_available: number | null
  nb_t3_available: number | null
  nb_t4_available: number | null
  nb_t5_available: number | null
  nb_t6_available: number | null
  nb_t7_more_available: number | null
}

export function calculateAvailability(properties: AvailabilityProperties): number | null {
  const availabilityValues = [
    properties.nb_t1_available,
    properties.nb_t1_bis_available,
    properties.nb_t2_available,
    properties.nb_t3_available,
    properties.nb_t4_available,
    properties.nb_t5_available,
    properties.nb_t6_available,
    properties.nb_t7_more_available,
  ]

  const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
  return nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null
}
