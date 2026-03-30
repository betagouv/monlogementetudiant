'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { parseAsString, useQueryState } from 'nuqs'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TCreateResidence, TYPOLOGIES, TYPOLOGY_TYPES } from '~/schemas/accommodations/create-residence'
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

  const getInitialTabId = () => (fields.length > 0 ? 'tab-0' : 'tab-add')
  const [selectedTabId, setSelectedTabId] = useQueryState('typology', parseAsString.withDefault(getInitialTabId()))

  const usedTypes = watchedTypologies?.map((t) => t.type).filter(Boolean) ?? []

  // Trier les champs selon l'ordre de TYPOLOGIES
  const sortedFieldsWithIndex = fields
    .map((field, originalIndex) => ({
      field,
      originalIndex,
      type: watchedTypologies?.[originalIndex]?.type,
    }))
    .sort((a, b) => {
      const indexA = TYPOLOGIES.findIndex((t) => t.type === a.type)
      const indexB = TYPOLOGIES.findIndex((t) => t.type === b.type)
      // Les "Nouveau" (sans type) vont à la fin
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })

  const handleAddTypology = () => {
    append({
      type: '' as TCreateResidence['typologies'][number]['type'],
      price_min: undefined as unknown as number,
      price_max: undefined as unknown as number,
      superficie_min: undefined as unknown as number,
      superficie_max: undefined as unknown as number,
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
    ...sortedFieldsWithIndex.map(({ originalIndex, type }) => ({
      tabId: `tab-${originalIndex}`,
      label: type || 'Nouveau',
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
            {sortedFieldsWithIndex.map(({ field, originalIndex }) => (
              <div key={field.id} className={selectedTabId === `tab-${originalIndex}` ? '' : 'fr-hidden'}>
                <TypologyTabContent
                  mode="create"
                  index={originalIndex}
                  typologyType={watchedTypologies?.[originalIndex]?.type}
                  usedTypes={usedTypes}
                  onDelete={() => handleRemoveTypology(originalIndex)}
                />
              </div>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
