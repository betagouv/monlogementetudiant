import type { TTypologiesRecord } from '~/schemas/accommodations/accommodations'

export function getLastAvailabilityUpdate(typologies: TTypologiesRecord): Date | null {
  const timestamps = Object.values(typologies)
    .map((t) => (t?.availabilityUpdatedAt ? new Date(t.availabilityUpdatedAt).getTime() : null))
    .filter((v): v is number => v != null && !Number.isNaN(v))
  return timestamps.length === 0 ? null : new Date(Math.max(...timestamps))
}
