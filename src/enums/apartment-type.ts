export const APARTMENT_TYPES = ['t1', 't1_bis', 't2', 't3', 't4', 't5', 't6', 't7_more'] as const
export type ApartmentType = (typeof APARTMENT_TYPES)[number]

export const APARTMENT_TYPE_LABELS: Record<ApartmentType, string> = {
  t1: 'T1 (Studio)',
  t1_bis: 'T1 bis',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7_more: 'T7+',
}

export function getAvailableApartmentTypes(accommodation: {
  nb_t1_available: number | null
  nb_t1_bis_available: number | null
  nb_t2_available: number | null
  nb_t3_available: number | null
  nb_t4_available: number | null
  nb_t5_available: number | null
  nb_t6_available: number | null
  nb_t7_more_available: number | null
}): ApartmentType[] {
  const mapping: Record<ApartmentType, number | null> = {
    t1: accommodation.nb_t1_available,
    t1_bis: accommodation.nb_t1_bis_available,
    t2: accommodation.nb_t2_available,
    t3: accommodation.nb_t3_available,
    t4: accommodation.nb_t4_available,
    t5: accommodation.nb_t5_available,
    t6: accommodation.nb_t6_available,
    t7_more: accommodation.nb_t7_more_available,
  }

  return APARTMENT_TYPES.filter((type) => (mapping[type] ?? 0) > 0)
}
