'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import toggleStyles from '~/components/shared/equipments-toggle.module.css'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

type Category = 'collective' | 'individual'

const categories: { key: Category; label: string }[] = [
  { key: 'collective', label: 'Résidence' },
  { key: 'individual', label: 'Logement' },
]

export const ResidenceEquipments = () => {
  const { control } = useFormContext<TUpdateResidence>()
  const [activeCategory, setActiveCategory] = useState<Category>('collective')

  const activeEquipments = EQUIPMENTS.filter((e) => e.category === activeCategory)

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <div className={toggleStyles.equipmentsHeader}>
          <h3>Équipements</h3>
          <div className={toggleStyles.equipmentsToggle}>
            {categories.map((category) => (
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
        {activeEquipments.map((equipment) => {
          const fieldName = equipment.key as keyof TUpdateResidence

          return (
            <Controller
              key={equipment.key}
              name={fieldName}
              control={control}
              render={({ field }) => {
                const value = field.value
                const hasEquipment = Boolean(value)
                const label = typeof equipment.label === 'function' ? equipment.label(value as string) : equipment.label

                const handleClick = () => {
                  // For boolean fields, toggle the value
                  if (fieldName === 'bathroom' || fieldName === 'kitchen_type') {
                    // For enum fields, cycle through values
                    if (fieldName === 'bathroom') {
                      const nextValue = value === 'private' ? 'shared' : value === 'shared' ? undefined : 'private'
                      field.onChange(nextValue)
                    } else if (fieldName === 'kitchen_type') {
                      const nextValue = value === 'private' ? 'shared' : value === 'shared' ? undefined : 'private'
                      field.onChange(nextValue)
                    }
                  } else {
                    // For boolean fields, toggle
                    field.onChange(!value)
                  }
                }

                return (
                  <Tag pressed={hasEquipment} className="fr-mx-1v fr-mb-2v" nativeButtonProps={{ type: 'button', onClick: handleClick }}>
                    {label}
                  </Tag>
                )
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
