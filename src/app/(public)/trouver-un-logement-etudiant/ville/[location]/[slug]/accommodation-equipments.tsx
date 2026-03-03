'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import toggleStyles from '~/components/shared/equipments-toggle.module.css'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import styles from './logement.module.css'

type AccommodationEquipmentsProps = {
  accommodation: TAccomodationDetails
}

const collectiveEquipments = EQUIPMENTS.filter((e) => e.category === 'collective')
const individualEquipments = EQUIPMENTS.filter((e) => e.category === 'individual')

type Category = 'collective' | 'individual'

export const AccommodationEquipments = ({ accommodation }: AccommodationEquipmentsProps) => {
  const t = useTranslations('accomodation')
  const hasCollective = collectiveEquipments.some((e) => accommodation[e.key as keyof TAccomodationDetails])
  const hasIndividual = individualEquipments.some((e) => accommodation[e.key as keyof TAccomodationDetails])

  const defaultCategory: Category = hasCollective ? 'collective' : 'individual'
  const [activeCategory, setActiveCategory] = useState<Category>(defaultCategory)

  if (!hasCollective && !hasIndividual) return null

  const activeEquipments = activeCategory === 'collective' ? collectiveEquipments : individualEquipments

  const categories: { key: Category; label: string; visible: boolean }[] = [
    { key: 'collective', label: 'Résidence', visible: hasCollective },
    { key: 'individual', label: 'Logement', visible: hasIndividual },
  ]

  return (
    <div className={styles.section}>
      <div className={toggleStyles.equipmentsHeader}>
        <h4>{t('equipments.title')}</h4>
        <div className={toggleStyles.equipmentsToggle}>
          {categories
            .filter((c) => c.visible)
            .map((category) => (
              <Button
                key={category.key}
                size="small"
                className={clsx(
                  toggleStyles.equipmentsToggleButton,
                  activeCategory === category.key && toggleStyles.equipmentsToggleButtonActive,
                )}
                priority={activeCategory === category.key ? 'secondary' : 'tertiary'}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </Button>
            ))}
        </div>
      </div>

      <div className={styles.equipmentsGrid}>
        {activeEquipments.map((equipment) => {
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
