import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import styles from './logement.module.css'

type AccommodationEquipmentsProps = {
  accommodation: TAccomodationDetails
}

export const AccommodationEquipments: FC<AccommodationEquipmentsProps> = async ({ accommodation }: AccommodationEquipmentsProps) => {
  const t = await getTranslations('accomodation')
  const equipmentsKeys = EQUIPMENTS.map((equipment) => equipment.key)
  const equipments = equipmentsKeys.filter((key) => accommodation[key as keyof TAccomodationDetails])
  if (equipments.length === 0) return null
  return (
    <div className={styles.section}>
      <h4>{t('equipments.title')}</h4>

      <div className={styles.equipmentsGrid}>
        {EQUIPMENTS.map((equipment) => {
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
