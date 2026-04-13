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

export interface StockProperties {
  nb_t1: number | null
  nb_t1_bis: number | null
  nb_t2: number | null
  nb_t3: number | null
  nb_t4: number | null
  nb_t5: number | null
  nb_t6: number | null
  nb_t7_more: number | null
}

export function calculateAvailability(availability: AvailabilityProperties, stock?: StockProperties): number | null {
  const pairs: { available: number | null; stock: number | null }[] = [
    { available: availability.nb_t1_available, stock: stock?.nb_t1 ?? null },
    { available: availability.nb_t1_bis_available, stock: stock?.nb_t1_bis ?? null },
    { available: availability.nb_t2_available, stock: stock?.nb_t2 ?? null },
    { available: availability.nb_t3_available, stock: stock?.nb_t3 ?? null },
    { available: availability.nb_t4_available, stock: stock?.nb_t4 ?? null },
    { available: availability.nb_t5_available, stock: stock?.nb_t5 ?? null },
    { available: availability.nb_t6_available, stock: stock?.nb_t6 ?? null },
    { available: availability.nb_t7_more_available, stock: stock?.nb_t7_more ?? null },
  ]

  // Only consider typologies that have stock
  const relevant = stock ? pairs.filter((p) => p.stock != null && p.stock > 0) : pairs
  const nonNullValues = relevant.filter(
    (p): p is { available: number; stock: number | null } => p.available !== null && p.available !== undefined,
  )

  if (nonNullValues.length === 0) return null
  return nonNullValues.reduce((sum, p) => sum + p.available, 0)
}
