'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TYPOLOGIES } from '~/schemas/accommodations/create-residence'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { TypologyTabContent } from './typology-tab-content'

type NewTypology = { id: number; fieldSuffix: string | null }

export const ResidenceAccommodationList = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const isImported = accommodation.properties.is_imported
  const t = useTranslations('findAccomodation.card')
  const { setValue, watch } = useFormContext()
  const [newTypologies, setNewTypologies] = useState<NewTypology[]>([])
  const [nextId, setNextId] = useState(1)

  // Calculer le premier onglet disponible
  const getInitialTabId = () => {
    const { nb_t1, nb_t1_bis, nb_t2, nb_t3, nb_t4, nb_t5, nb_t6, nb_t7_more } = accommodation.properties
    const typologyData = [
      { fieldSuffix: 't1', total: nb_t1 },
      { fieldSuffix: 't1_bis', total: nb_t1_bis },
      { fieldSuffix: 't2', total: nb_t2 },
      { fieldSuffix: 't3', total: nb_t3 },
      { fieldSuffix: 't4', total: nb_t4 },
      { fieldSuffix: 't5', total: nb_t5 },
      { fieldSuffix: 't6', total: nb_t6 },
      { fieldSuffix: 't7_more', total: nb_t7_more },
    ]
    const firstWithData = typologyData.find((t) => t.total !== null && t.total >= 1)
    return firstWithData ? `tab-${firstWithData.fieldSuffix}` : 'tab-add'
  }

  const [selectedTabId, setSelectedTabId] = useQueryState('typology', parseAsString.withDefault(getInitialTabId()))

  const nbAvailable = calculateAvailability({
    nb_t1_available: accommodation.properties.nb_t1_available,
    nb_t1_bis_available: accommodation.properties.nb_t1_bis_available,
    nb_t2_available: accommodation.properties.nb_t2_available,
    nb_t3_available: accommodation.properties.nb_t3_available,
    nb_t4_available: accommodation.properties.nb_t4_available,
    nb_t5_available: accommodation.properties.nb_t5_available,
    nb_t6_available: accommodation.properties.nb_t6_available,
    nb_t7_more_available: accommodation.properties.nb_t7_more_available,
  })

  // Observer les valeurs du formulaire pour les totaux (réactif aux changements)
  const formTotals: Record<string, number | null> = {
    t1: watch('nb_t1'),
    t1_bis: watch('nb_t1_bis'),
    t2: watch('nb_t2'),
    t3: watch('nb_t3'),
    t4: watch('nb_t4'),
    t5: watch('nb_t5'),
    t6: watch('nb_t6'),
    t7_more: watch('nb_t7_more'),
  }

  // Typologies existantes (basé sur les valeurs du formulaire, réactif aux suppressions)
  const existingTypologies = TYPOLOGIES.filter((typo) => formTotals[typo.fieldSuffix] != null && formTotals[typo.fieldSuffix]! >= 1)

  // FieldSuffixes déjà utilisés (existants + nouveaux avec type sélectionné)
  const usedFieldSuffixes = [
    ...existingTypologies.map((t) => t.fieldSuffix),
    ...newTypologies.filter((t) => t.fieldSuffix !== null).map((t) => t.fieldSuffix as string),
  ]

  // Toutes les typologies visibles, triées selon l'ordre de TYPOLOGIES
  const sortedVisibleTypologies = TYPOLOGIES.filter((typo) => usedFieldSuffixes.includes(typo.fieldSuffix))

  // Typologies disponibles pour ajout
  const availableTypologies = TYPOLOGIES.filter((typo) => !usedFieldSuffixes.includes(typo.fieldSuffix))

  const canAddMore = availableTypologies.length > 0 && !isImported

  const handleAddNewTypology = () => {
    const newId = nextId
    setNewTypologies((prev) => [...prev, { id: newId, fieldSuffix: null }])
    setNextId((prev) => prev + 1)
    setSelectedTabId(`tab-new-${newId}`)
  }

  const handleTypeSelect = (newTypologyId: number, fieldSuffix: string) => {
    setNewTypologies((prev) => prev.map((t) => (t.id === newTypologyId ? { ...t, fieldSuffix } : t)))
    setSelectedTabId(`tab-${fieldSuffix}`)
  }

  const handleTabChange = (tabId: string) => {
    if (tabId === 'tab-add') {
      handleAddNewTypology()
    } else {
      setSelectedTabId(tabId)
    }
  }

  const handleDeleteExistingTypology = (fieldSuffix: string) => {
    // Mettre les champs à null dans le formulaire (l'onglet disparaîtra automatiquement via watch)
    const fields = [
      `nb_${fieldSuffix}`,
      `nb_${fieldSuffix}_available`,
      `price_min_${fieldSuffix}`,
      `price_max_${fieldSuffix}`,
      `superficie_min_${fieldSuffix}`,
      `superficie_max_${fieldSuffix}`,
    ]
    for (const field of fields) {
      setValue(field, null)
    }

    // Sélectionner le premier onglet disponible après suppression
    const remainingTypologies = sortedVisibleTypologies.filter((t) => t.fieldSuffix !== fieldSuffix)
    if (remainingTypologies.length > 0) {
      setSelectedTabId(`tab-${remainingTypologies[0].fieldSuffix}`)
    } else if (newTypologies.length > 0) {
      setSelectedTabId(`tab-new-${newTypologies[0].id}`)
    } else {
      setSelectedTabId('tab-add')
    }
  }

  const handleDeleteNewTypology = (id: number) => {
    setNewTypologies((prev) => prev.filter((t) => t.id !== id))
    // Sélectionner un autre onglet
    if (sortedVisibleTypologies.length > 0) {
      setSelectedTabId(`tab-${sortedVisibleTypologies[0].fieldSuffix}`)
    } else {
      setSelectedTabId('tab-add')
    }
  }

  // Construire les tabs
  const tabs = [
    // Onglets triés selon l'ordre de TYPOLOGIES
    ...sortedVisibleTypologies.map((typo) => ({
      tabId: `tab-${typo.fieldSuffix}`,
      label: typo.type,
    })),
    // Onglets nouveaux (sans type sélectionné)
    ...newTypologies
      .filter((t) => t.fieldSuffix === null)
      .map((t) => ({
        tabId: `tab-new-${t.id}`,
        label: 'Nouveau',
      })),
    // Onglet Ajouter
    ...(canAddMore ? [{ tabId: 'tab-add', label: 'Ajouter' }] : []),
  ]

  const validTabIds = tabs.map((t) => t.tabId)
  useEffect(() => {
    if (selectedTabId && !validTabIds.includes(selectedTabId)) {
      const firstValidTab = validTabIds[0] || 'tab-add'
      setSelectedTabId(firstValidTab)
    }
  }, [selectedTabId, validTabIds, setSelectedTabId])

  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('noAvailability')} availabilityText={t('availability')} as="span" />
  )

  return (
    <div>
      <div className="fr-p-2w fr-p-md-6w">
        <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-2w">
          <h3 className="fr-mb-0">{accommodation.properties.nb_total_apartments} logements</h3>
          {badgeAvailability}
        </div>

        <div>
          <Tabs selectedTabId={selectedTabId} onTabChange={handleTabChange} tabs={tabs}>
            {/* Onglets triés selon l'ordre de TYPOLOGIES */}
            {sortedVisibleTypologies.map((typo) => (
              <div key={typo.fieldSuffix} className={selectedTabId === `tab-${typo.fieldSuffix}` ? '' : 'fr-hidden'}>
                <TypologyTabContent
                  mode="update"
                  fieldSuffix={typo.fieldSuffix}
                  typologyType={typo.type}
                  isImported={isImported}
                  onDelete={!isImported ? () => handleDeleteExistingTypology(typo.fieldSuffix) : undefined}
                />
              </div>
            ))}
            {/* Onglets nouveaux (sans type sélectionné) */}
            {newTypologies
              .filter((t) => t.fieldSuffix === null)
              .map((t) => (
                <div key={`new-${t.id}`} className={selectedTabId === `tab-new-${t.id}` ? '' : 'fr-hidden'}>
                  <TypologyTabContent
                    mode="update-new"
                    fieldSuffix={null}
                    availableTypes={availableTypologies.map((typ) => ({ type: typ.type, fieldSuffix: typ.fieldSuffix }))}
                    onTypeSelect={(fieldSuffix) => handleTypeSelect(t.id, fieldSuffix)}
                    onDelete={() => handleDeleteNewTypology(t.id)}
                  />
                </div>
              ))}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
