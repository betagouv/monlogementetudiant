'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TCreateResidence, TYPOLOGY_LABELS, TYPOLOGY_TYPES } from '~/schemas/accommodations/create-residence'
import { TypologyTabContent } from './typology-tab-content'

export const CreateResidenceAccommodationList = () => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<TCreateResidence>()

  const watchedTypologies = watch('typologies')

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'typologies',
  })

  const [selectedTabId, setSelectedTabId] = useState(fields.length > 0 ? `tab-0` : 'tab-add')

  const getTabLabel = (index: number) => {
    const type = watchedTypologies?.[index]?.type
    return type ? TYPOLOGY_LABELS[type] : 'Nouveau'
  }

  const usedTypes = watchedTypologies?.map((t) => t.type).filter(Boolean) ?? []

  const handleAddTypology = () => {
    append({
      type: '' as TCreateResidence['typologies'][number]['type'],
      price_min: undefined as unknown as number,
      price_max: undefined as unknown as number,
      superficie_min: undefined,
      superficie_max: undefined,
      colocation: false,
      nb_total: undefined as unknown as number,
      nb_available: undefined as unknown as number,
    })
    setSelectedTabId(`tab-${fields.length}`)
  }

  const handleRemoveTypology = (index: number) => {
    remove(index)
    if (fields.length > 1) {
      const newIndex = index > 0 ? index - 1 : 0
      setSelectedTabId(`tab-${newIndex}`)
    }
  }

  const canAddMore = fields.length < TYPOLOGY_TYPES.length

  const tabs = [
    ...fields.map((_, index) => ({
      tabId: `tab-${index}`,
      label: getTabLabel(index),
    })),
    ...(canAddMore ? [{ tabId: 'tab-add', label: 'Ajouter' }] : []),
  ]

  const handleTabChange = (tabId: string) => {
    if (tabId === 'tab-add') {
      handleAddTypology()
    } else {
      setSelectedTabId(tabId)
    }
  }

  return (
    <div>
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Logements</h3>

        {errors.typologies?.root && <p className="fr-error-text">{errors.typologies.root.message}</p>}
        {errors.typologies?.message && <p className="fr-error-text">{errors.typologies.message}</p>}

        <div>
          <Tabs selectedTabId={selectedTabId} onTabChange={handleTabChange} tabs={tabs}>
            {fields.map((field, index) => (
              <div key={field.id} className={selectedTabId === `tab-${index}` ? '' : 'fr-hidden'}>
                <TypologyTabContent
                  mode="create"
                  index={index}
                  typologyType={watchedTypologies?.[index]?.type}
                  usedTypes={usedTypes}
                  onDelete={() => handleRemoveTypology(index)}
                />
              </div>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
