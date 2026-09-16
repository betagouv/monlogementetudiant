import type { accommodations } from '~/server/db/schema/accommodations'

// `key` is constrained to a real accommodation field (camelCase, from the Drizzle schema). This makes
// any snake_case / stale key a compile error — the API response (getBySlug) and the form schemas
// (ZUpdateResidence / ZCreateResidence) all derive from these same field names.
type AccommodationField = keyof typeof accommodations.$inferSelect

export type Equipment = {
  icon: string
  key: AccommodationField
  label: string | ((value: string) => string)
  category: 'collective' | 'individual'
}

export const EQUIPMENTS: Equipment[] = [
  {
    icon: 'ri-fridge-line',
    key: 'refrigerator',
    label: 'Frigo',
    category: 'individual',
  },
  {
    icon: 'ri-t-shirt-air-line',
    key: 'laundryRoom',
    label: 'Laverie',
    category: 'collective',
  },
  {
    icon: 'ri-bubble-chart-line',
    key: 'bathroom',
    label: (value: string) => (value === 'shared' ? 'Salle de bain partagée' : 'Salle de bain privée'),
    category: 'individual',
  },
  {
    icon: 'ri-restaurant-line',
    key: 'kitchenType',
    label: (value: string) => (value === 'shared' ? 'Cuisine partagée' : 'Cuisine privée'),
    category: 'individual',
  },
  {
    icon: 'ri-bowl-line',
    key: 'microwave',
    label: 'Micro-onde',
    category: 'individual',
  },
  {
    icon: 'ri-lock-line',
    key: 'secureAccess',
    label: 'Accès sécurisé',
    category: 'collective',
  },
  {
    icon: 'ri-parking-box-line',
    key: 'parking',
    label: 'Parking',
    category: 'collective',
  },
  {
    icon: 'ri-community-line',
    key: 'commonAreas',
    label: 'Espaces communs',
    category: 'collective',
  },
  {
    icon: 'ri-riding-line',
    key: 'bikeStorage',
    label: 'Garage à vélos',
    category: 'collective',
  },
  {
    icon: 'ri-ball-pen-line',
    key: 'desk',
    label: 'Bureau',
    category: 'individual',
  },
  {
    icon: 'ri-user-2-line',
    key: 'residenceManager',
    label: 'Conciergerie',
    category: 'collective',
  },
  {
    icon: 'fr-icon-sign-language-line',
    key: 'cookingPlates',
    label: 'Plaques de cuisson',
    category: 'individual',
  },
  {
    icon: 'ri-wifi-line',
    key: 'wifi',
    label: 'Wifi',
    category: 'collective',
  },
]

/**
 * Clé de traduction du libellé d'un équipement, relative au namespace `accomodation.equipments.items`.
 * Les équipements à libellé variable (salle de bain, cuisine) ont une sous-clé `shared` / `private`,
 * sur la même convention que `label`.
 */
export const getEquipmentLabelKey = (equipment: Equipment, value: unknown): string =>
  typeof equipment.label === 'function' ? `${equipment.key}.${value === 'shared' ? 'shared' : 'private'}` : equipment.key
