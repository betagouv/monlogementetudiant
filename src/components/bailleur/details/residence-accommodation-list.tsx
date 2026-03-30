'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useState } from 'react'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TYPOLOGIES } from '~/schemas/accommodations/create-residence'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { TypologyTabContent } from './typology-tab-content'

type NewTypology = { id: number; fieldSuffix: string | null }

export const ResidenceAccommodationList = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const t = useTranslations('findAccomodation.card')
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

  const {
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
    nb_t1,
    nb_t1_bis,
    nb_t2,
    nb_t3,
    nb_t4,
    nb_t5,
    nb_t6,
    nb_t7_more,
  } = accommodation.properties

  const nbAvailable = calculateAvailability({
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
  })

  const totals: Record<string, number | null> = {
    t1: nb_t1,
    t1_bis: nb_t1_bis,
    t2: nb_t2,
    t3: nb_t3,
    t4: nb_t4,
    t5: nb_t5,
    t6: nb_t6,
    t7_more: nb_t7_more,
  }

  // Typologies existantes (seulement celles avec données en BDD)
  const existingTypologies = TYPOLOGIES.filter((typo) => totals[typo.fieldSuffix] !== null && totals[typo.fieldSuffix]! >= 1)

  // FieldSuffixes déjà utilisés (existants + nouveaux avec type sélectionné)
  const usedFieldSuffixes = [
    ...existingTypologies.map((t) => t.fieldSuffix),
    ...newTypologies.filter((t) => t.fieldSuffix !== null).map((t) => t.fieldSuffix as string),
  ]

  // Toutes les typologies visibles, triées selon l'ordre de TYPOLOGIES
  const sortedVisibleTypologies = TYPOLOGIES.filter((typo) => usedFieldSuffixes.includes(typo.fieldSuffix))

  // Typologies disponibles pour ajout
  const availableTypologies = TYPOLOGIES.filter((typo) => !usedFieldSuffixes.includes(typo.fieldSuffix))

  const canAddMore = availableTypologies.length > 0

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
                <TypologyTabContent mode="update" fieldSuffix={typo.fieldSuffix} typologyType={typo.type} />
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
                  />
                </div>
              ))}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
