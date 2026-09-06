import { EOwnerContactMode, OWNER_CONTACT_MODE_LABELS } from '~/enums/owner-contact-mode'
import { getTypologyLabel, TYPOLOGIES, type TypologyType } from '~/schemas/accommodations/typology'

/**
 * Libellés des champs affichés dans le diff des journaux d'activité.
 *
 * Deux conventions de nommage coexistent et doivent le rester :
 *
 * - AVANT le 21/07/2026, les données de typologie vivaient dans des colonnes plates de
 *   `accommodation` (`nbT1Available`, `superficieMinT1`, `priceMaxT3`…). Les entrées déjà
 *   enregistrées portent ces clés et ne seront jamais réécrites.
 * - DEPUIS, elles vivent dans `accommodation_typology` et le diff émet des clés structurées
 *   `typologies.<type>.<champ>` (voir server/services/typology-diff.ts).
 *
 * Les deux se résolvent vers le même libellé, pour que le journal reste lisible de bout en bout.
 */

/** Champs d'une typologie, communs aux deux conventions. */
const TYPOLOGY_FIELD_LABELS = {
  nbTotal: 'Nombre total de logements',
  nbAvailable: 'Logements disponibles',
  priceMin: 'Loyer minimum',
  priceMax: 'Loyer maximum',
  superficieMin: 'Superficie minimum',
  superficieMax: 'Superficie maximum',
  colocation: 'Colocation',
  present: 'Typologie présente',
} as const

export type TypologyField = keyof typeof TYPOLOGY_FIELD_LABELS

/** Suffixe utilisé par les anciennes colonnes plates, par type de typologie. */
const LEGACY_SUFFIX: Record<TypologyType, string> = {
  t1: 'T1',
  t1_bis: 'T1Bis',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7_more: 'T7More',
}

/**
 * Table exhaustive ancienne clé -> (type, champ). Construite par énumération plutôt que par regex :
 * `nbT1` et `nbT1Bis` ne se distinguent pas de façon fiable par un motif, et `nbAccessibleApartments`
 * ne doit surtout pas être interprété comme une typologie.
 */
const LEGACY_KEYS: Record<string, { type: TypologyType; field: TypologyField }> = Object.fromEntries(
  TYPOLOGIES.flatMap(({ type }) => {
    const s = LEGACY_SUFFIX[type]
    return [
      [`nb${s}`, { type, field: 'nbTotal' as const }],
      [`nb${s}Available`, { type, field: 'nbAvailable' as const }],
      [`priceMin${s}`, { type, field: 'priceMin' as const }],
      [`priceMax${s}`, { type, field: 'priceMax' as const }],
      [`superficieMin${s}`, { type, field: 'superficieMin' as const }],
      [`superficieMax${s}`, { type, field: 'superficieMax' as const }],
    ]
  }),
)

/** Champs de la résidence elle-même (table `accommodation`). */
const ACCOMMODATION_FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  description: 'Description',
  published: 'Publiée',
  address: 'Adresse',
  postalCode: 'Code postal',
  residenceType: 'Type de résidence',
  targetAudience: 'Public visé',
  target_audience: 'Public visé',
  externalUrl: 'Lien externe',
  virtualTourUrl: 'Visite virtuelle',
  imagesUrls: 'Photos',
  rentalChargesDetails: 'Détail des charges',
  acceptWaitingList: 'Liste d’attente',
  scholarshipHoldersPriority: 'Priorité boursiers',
  socialHousingRequired: 'Logement social requis',
  nbAccessibleApartments: 'Logements accessibles',
  nbColivingApartments: 'Logements en coliving',
  bathroom: 'Salle de bain',
  kitchenType: 'Cuisine',
  refrigerator: 'Réfrigérateur',
  microwave: 'Micro-ondes',
  cookingPlates: 'Plaques de cuisson',
  laundryRoom: 'Buanderie',
  secureAccess: 'Accès sécurisé',
  parking: 'Parking',
  commonAreas: 'Espaces communs',
  bikeStorage: 'Local à vélos',
  desk: 'Bureau',
  residenceManager: 'Gestionnaire sur place',
  wifi: 'Wifi',
}

/** Champs de la fiche gestionnaire (table `owner`). */
const OWNER_FIELD_LABELS: Record<string, string> = {
  contactMode: 'Mode de réception des candidatures',
}

export type ParsedDiffField = { typology: TypologyType; field: TypologyField } | null

/** Reconnaît une clé de typologie, dans l'une ou l'autre convention. */
export function parseTypologyDiffKey(key: string): ParsedDiffField {
  const legacy = LEGACY_KEYS[key]
  if (legacy) return { typology: legacy.type, field: legacy.field }

  const parts = key.split('.')
  if (parts.length === 3 && parts[0] === 'typologies') {
    const [, type, field] = parts
    if (type in LEGACY_SUFFIX && field in TYPOLOGY_FIELD_LABELS) {
      return { typology: type as TypologyType, field: field as TypologyField }
    }
  }
  return null
}

/** Libellé lisible d'une clé de diff, quelle que soit la convention. Retourne la clé brute si inconnue. */
export function formatDiffFieldLabel(key: string): string {
  const typology = parseTypologyDiffKey(key)
  if (typology) return `${getTypologyLabel(typology.typology)} · ${TYPOLOGY_FIELD_LABELS[typology.field]}`
  return ACCOMMODATION_FIELD_LABELS[key] ?? OWNER_FIELD_LABELS[key] ?? key
}

/**
 * Rendu d'une valeur de diff : booléens en français, absence explicite, listes comptées.
 * `key` permet de traduire les valeurs d'énumération stockées en brut (ex. `dossier_facile`).
 */
export function formatDiffValue(value: unknown, key?: string): string {
  if (key === 'contactMode' && typeof value === 'string' && value in OWNER_CONTACT_MODE_LABELS) {
    return OWNER_CONTACT_MODE_LABELS[value as EOwnerContactMode]
  }
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return `${value.length} élément(s)`
  return String(value)
}
