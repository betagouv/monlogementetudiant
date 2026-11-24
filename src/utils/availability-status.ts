export type TAvailabilityStatus = 'available' | 'none' | 'unknown'

export const getAvailabilityStatus = (nbAvailable: number | null | undefined): TAvailabilityStatus => {
  if (nbAvailable === null || nbAvailable === undefined) return 'unknown'
  return nbAvailable > 0 ? 'available' : 'none'
}
