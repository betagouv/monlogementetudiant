'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import toggleStyles from '~/components/shared/equipments-toggle.module.css'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

type Category = 'collective' | 'individual'

const ENUM_FIELDS = ['bathroom', 'kitchen_type'] as const
const ENUM_OPTIONS = ['private', 'shared'] as const

const categories: { key: Category; label: string }[] = [
  { key: 'collective', label: 'Résidence' },
  { key: 'individual', label: 'Logement' },
]

export const CreateResidenceEquipments = () => {
  const { control } = useFormContext<TCreateResidence>()
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
                type="button"
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>
        {activeEquipments.map((equipment) => {
          const fieldName = equipment.key as keyof TCreateResidence
          const isEnum = ENUM_FIELDS.includes(fieldName as (typeof ENUM_FIELDS)[number])

          if (isEnum) {
            return (
              <Controller
                key={equipment.key}
                name={fieldName}
                control={control}
                render={({ field }) => (
                  <>
                    {ENUM_OPTIONS.map((option) => {
                      const label = typeof equipment.label === 'function' ? equipment.label(option) : equipment.label
                      const isSelected = field.value === option

                      return (
                        <Tag
                          key={`${equipment.key}-${option}`}
                          pressed={isSelected}
                          className="fr-mx-1v fr-mb-2v"
                          nativeButtonProps={{
                            type: 'button',
                            onClick: () => field.onChange(isSelected ? undefined : option),
                          }}
                        >
                          {label}
                        </Tag>
                      )
                    })}
                  </>
                )}
              />
            )
          }

          return (
            <Controller
              key={equipment.key}
              name={fieldName}
              control={control}
              render={({ field }) => (
                <Tag
                  pressed={Boolean(field.value)}
                  className="fr-mx-1v fr-mb-2v"
                  nativeButtonProps={{
                    type: 'button',
                    onClick: () => field.onChange(!field.value),
                  }}
                >
                  {typeof equipment.label === 'function' ? equipment.label(field.value as string) : equipment.label}
                </Tag>
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
