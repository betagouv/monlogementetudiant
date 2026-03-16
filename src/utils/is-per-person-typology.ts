const PER_PERSON_TYPOLOGIES = new Set(['T3', 'T4', 'T5', 'T6', 'T7+'])

export function isPerPersonTypology(typology?: string) {
  return !!typology && PER_PERSON_TYPOLOGIES.has(typology)
}
