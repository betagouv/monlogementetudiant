import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import styles from './logement.module.css'

type AccommodationEquipmentsProps = {
  accommodation: TAccomodationDetails
}

const availableEquipments = [
  {
    icon: 'ri-fridge-line',
    key: 'refrigerator',
    label: 'Frigo',
  },
  {
    icon: 'ri-t-shirt-air-line',
    key: 'laundry_room',
    label: 'Buanderie',
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
]

export const AccommodationEquipments: FC<AccommodationEquipmentsProps> = async ({ accommodation }: AccommodationEquipmentsProps) => {
  const t = await getTranslations('accomodation')
  const equipmentsKeys = availableEquipments.map((equipment) => equipment.key)
  const equipments = equipmentsKeys.filter((key) => accommodation[key as keyof TAccomodationDetails])
  if (equipments.length === 0) return null
  return (
    <div className={styles.section}>
      <h4>{t('equipments.title')}</h4>

      <div className={styles.equipmentsGrid}>
        {availableEquipments.map((equipment) => {
          const value = accommodation[equipment.key as keyof TAccomodationDetails]
          if (!value) return null

          const label = typeof equipment.label === 'function' ? equipment.label(value as string) : equipment.label

          return (
            <div key={equipment.key}>
              <span className={clsx(equipment.icon, 'fr-mr-1v')} />
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
