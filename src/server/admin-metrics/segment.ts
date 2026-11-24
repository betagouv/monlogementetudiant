export type TOwnerSegment = 'bon_eleve' | 'irregulier' | 'mauvais_eleve' | 'non_concerne'

export const SEGMENT_LABELS: Record<TOwnerSegment, string> = {
  bon_eleve: 'Bon élève',
  irregulier: 'Irrégulier',
  mauvais_eleve: 'Mauvais élève',
  non_concerne: 'Non concerné',
}

export const segmentOwner = (f: { aTraiter: number; traites: number; alertes: number; suspensions: number }): TOwnerSegment => {
  if (f.suspensions > 0) return 'mauvais_eleve'
  if (f.aTraiter === 0) return 'non_concerne'
  if (f.traites === 0) return 'mauvais_eleve'
  if (f.alertes > 0) return 'irregulier'
  return 'bon_eleve'
}
