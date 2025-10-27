'use client'

import { Tag } from '@codegouvfr/react-dsfr/Tag'
import { EQUIPMENTS } from '~/helpers/equipments'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const ResidenceEquipments = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <h3>Équipements</h3>
        {EQUIPMENTS.map((equipment) => {
          const value = accommodation[equipment.key as keyof TAccomodationDetails]
          const hasEquipment = Boolean(value)
          const label = typeof equipment.label === 'function' ? equipment.label(value as string) : equipment.label

          return (
            <Tag
              key={equipment.key}
              pressed={hasEquipment}
              className="fr-mx-1v fr-mb-2v"
              {...(hasEquipment && { nativeButtonProps: { onClick: () => console.log('test') } })}
            >
              {label}
            </Tag>
          )
        })}
      </div>
    </div>
  )
}
