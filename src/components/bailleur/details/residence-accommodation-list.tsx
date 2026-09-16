'use client'

import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { useIsAdmin } from '~/hooks/use-is-admin'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TYPOLOGIES, TYPOLOGY_TYPES } from '~/schemas/accommodations/typology'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { TypologyTabContent } from './typology-tab-content'

export const ResidenceAccommodationList = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const isAdmin = useIsAdmin()
  const isImported = accommodation.isImported
  const t = useTranslations('findAccomodation.card')
  const tTypology = useTranslations('bailleur.residences.details.typologyTab')
  const tTypologies = useTranslations('schemas.typologies')
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()

  const watchedTypologies = watch('typologies')
  const { fields, append, remove } = useFieldArray({ control, name: 'typologies' })

  const getInitialTabId = () => (fields.length > 0 ? 'tab-0' : 'tab-add')
  const [selectedTabId, setSelectedTabId] = useQueryState('typology', parseAsString.withDefault(getInitialTabId()))

  const nbAvailable = calculateAvailability(accommodation.typologies)
  const usedTypes = watchedTypologies?.map((t) => t.type).filter(Boolean) ?? []

  const sortedFieldsWithIndex = fields
    .map((field, originalIndex) => ({ field, originalIndex, type: watchedTypologies?.[originalIndex]?.type }))
    .sort((a, b) => {
      const indexA = TYPOLOGIES.findIndex((t) => t.type === a.type)
      const indexB = TYPOLOGIES.findIndex((t) => t.type === b.type)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })

  const canAddMore = fields.length < TYPOLOGY_TYPES.length && (!isImported || isAdmin)

  const handleAddTypology = () => {
    append({
      type: '' as NonNullable<TUpdateResidence['typologies']>[number]['type'],
      priceMin: undefined,
      priceMax: undefined,
      superficieMin: undefined,
      superficieMax: undefined,
      colocation: false,
      nbTotal: undefined,
      nbAvailable: undefined,
    })
    setSelectedTabId(`tab-${fields.length}`)
  }

  const handleRemoveTypology = (index: number) => {
    remove(index)
    if (fields.length > 1) setSelectedTabId(`tab-${index > 0 ? index - 1 : 0}`)
  }

  const hasTypologyError = (index: number) => {
    const typologyErrors = errors.typologies
    return !!typologyErrors?.[index] && Object.keys(typologyErrors[index] ?? {}).length > 0
  }
  const hasAnyTypologyError = fields.some((_, index) => hasTypologyError(index))

  const tabLabel = (label: string, index: number) =>
    hasTypologyError(index) ? (
      <span>
        {label} <span style={{ color: 'var(--text-default-error)', fontWeight: 'bold' }}>●</span>
      </span>
    ) : (
      label
    )

  const tabs = [
    ...sortedFieldsWithIndex.map(({ originalIndex, type }) => ({
      tabId: `tab-${originalIndex}`,
      label: tabLabel(type ? tTypologies(type) : tTypology('newTab'), originalIndex),
    })),
    ...(canAddMore ? [{ tabId: 'tab-add', label: tTypology('addTab') }] : []),
  ]

  const handleTabChange = (tabId: string) => {
    if (tabId === 'tab-add') handleAddTypology()
    else setSelectedTabId(tabId)
  }

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-2w">
          <h3 className="fr-mb-0">{tTypology('housingCount', { count: accommodation.nbTotalApartments ?? 0 })}</h3>
          <AvailabilityBadge
            nbAvailable={nbAvailable}
            noAvailabilityText={t('noAvailability')}
            availabilityText={(count) => t('availabilityCount', { count })}
            unknownAvailabilityText={t('unknownAvailability')}
            as="span"
            context="owner"
          />
        </div>

        {hasAnyTypologyError && <p className="fr-error-text fr-mb-2w">{tTypology('tabsHaveErrors')}</p>}

        <div>
          <Tabs selectedTabId={selectedTabId} onTabChange={handleTabChange} tabs={tabs}>
            {/* Seul l'onglet sélectionné est rendu : des inputs masqués mais présents dans le DOM
                font échouer la validation native du navigateur sur des champs non focusables.
                Les valeurs et erreurs des autres typologies restent dans l'état RHF. */}
            {sortedFieldsWithIndex
              .filter(({ originalIndex }) => selectedTabId === `tab-${originalIndex}`)
              .map(({ field, originalIndex }) => (
                <div key={field.id}>
                  <TypologyTabContent
                    index={originalIndex}
                    typologyType={watchedTypologies?.[originalIndex]?.type}
                    usedTypes={usedTypes}
                    onDelete={!isImported || isAdmin ? () => handleRemoveTypology(originalIndex) : undefined}
                  />
                </div>
              ))}
          </Tabs>
        </div>
      </div>
    </div>
  )
}
