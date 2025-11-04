'use client'

import { Tag } from '@codegouvfr/react-dsfr/Tag'
import { Controller, useFormContext } from 'react-hook-form'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceEquipments = () => {
  const { control } = useFormContext<TUpdateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <h3>Équipements</h3>
        {EQUIPMENTS.map((equipment) => {
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
                  <Tag pressed={hasEquipment} className="fr-mx-1v fr-mb-2v" nativeButtonProps={{ onClick: handleClick }}>
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
