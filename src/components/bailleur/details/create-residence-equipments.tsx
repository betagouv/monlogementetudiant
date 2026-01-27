'use client'

import { Tag } from '@codegouvfr/react-dsfr/Tag'
import { Controller, useFormContext } from 'react-hook-form'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

const ENUM_FIELDS = ['bathroom', 'kitchen_type'] as const
const ENUM_OPTIONS = ['private', 'shared'] as const

export const CreateResidenceEquipments = () => {
  const { control } = useFormContext<TCreateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Équipements</h3>
        {EQUIPMENTS.map((equipment) => {
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
