'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Tag } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import toggleStyles from '~/components/shared/equipments-toggle.module.css'
import { EQUIPMENTS, getEquipmentLabelKey } from '~/helpers/equipments'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

type Category = 'collective' | 'individual'

const ENUM_FIELDS = ['bathroom', 'kitchenType'] as const
const ENUM_OPTIONS = ['private', 'shared'] as const

const CATEGORIES: Category[] = ['collective', 'individual']

export const ResidenceEquipments = () => {
  const t = useTranslations('bailleur.residences.details.equipments')
  const tEquipments = useTranslations('accomodation.equipments')
  const { control } = useFormContext<TUpdateResidence>()
  const [activeCategory, setActiveCategory] = useState<Category>('collective')

  const activeEquipments = EQUIPMENTS.filter((e) => e.category === activeCategory)

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <div className={toggleStyles.equipmentsHeader}>
          <h3>{t('title')}</h3>
          <div className={toggleStyles.equipmentsToggle}>
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                size="small"
                className={clsx(
                  toggleStyles.equipmentsToggleButton,
                  activeCategory === category && toggleStyles.equipmentsToggleButtonActive,
                )}
                priority={activeCategory === category ? 'secondary' : 'tertiary'}
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  setActiveCategory(category)
                }}
              >
                {tEquipments(`categories.${category}`)}
              </Button>
            ))}
          </div>
        </div>
        {activeEquipments.map((equipment) => {
          const fieldName = equipment.key as keyof TUpdateResidence
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
                      const label = tEquipments(`items.${getEquipmentLabelKey(equipment, option)}`)
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
                  {tEquipments(`items.${getEquipmentLabelKey(equipment, field.value)}`)}
                </Tag>
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
