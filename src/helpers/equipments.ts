export const EQUIPMENTS = [
  {
    icon: 'ri-fridge-line',
    key: 'refrigerator',
    label: 'Frigo',
  },
  {
    icon: 'ri-t-shirt-air-line',
    key: 'laundry_room',
    label: 'Laverie',
  },
  {
    icon: 'ri-bubble-chart-line',
    key: 'bathroom',
    label: (value: string) => (value === 'private' ? 'Salle de bain privée' : 'Salle de bain partagée'),
  },
  {
    icon: 'ri-restaurant-line',
    key: 'kitchen_type',
    label: (value: string) => (value === 'private' ? 'Cuisine privée' : 'Cuisine partagée'),
  },
  {
    icon: 'ri-bowl-line',
    key: 'microwave',
    label: 'Micro-onde',
  },
  {
    icon: 'ri-lock-line',
    key: 'secure_access',
    label: 'Accès sécurisé',
  },
  {
    icon: 'ri-parking-box-line',
    key: 'parking',
    label: 'Parking',
  },
  {
    icon: 'ri-community-line',
    key: 'common_areas',
    label: 'Espaces communs',
  },
  {
    icon: 'ri-riding-line',
    key: 'bike_storage',
    label: 'Garage à vélos',
  },
  {
    icon: 'ri-ball-pen-line',
    key: 'desk',
    label: 'Bureau',
  },
  {
    icon: 'ri-user-2-line',
    key: 'residence_manager',
    label: 'Conciergerie',
  },
  {
    icon: 'fr-icon-sign-language-line',
    key: 'cooking_plates',
    label: 'Plaques de cuisson',
  },
  {
    icon: 'ri-wifi-line',
    key: 'wifi',
    label: 'Wifi',
  },
]
