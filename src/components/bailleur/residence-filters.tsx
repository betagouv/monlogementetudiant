'use client'

import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs'
import { SearchInput } from '~/components/ui/search-input'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'

const ResidenceFiltersSkeleton = () => {
  return (
    <>
      <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '40px' }} />
      <div className="fr-width-full fr-flex fr-flex-gap-4v fr-justify-content-end">
        <div className="skeleton-rectangle skeleton-rectangle--200" style={{ height: '40px' }} />
        <div className="skeleton-rectangle skeleton-rectangle--240" style={{ height: '40px' }} />
      </div>
    </>
  )
}

export const ResidenceFilters = () => {
  const t = useTranslations('bailleur.residences.list')
  const { data: accommodations, isLoading } = useMyAccommodations()
  const [queryStates, setQueryStates] = useQueryStates({
    disponible: parseAsBoolean.withDefault(false),
    recherche: parseAsString.withDefault(''),
  })
  if (isLoading) {
    return <ResidenceFiltersSkeleton />
  }

  return (
    <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-md-center fr-mb-4w fr-flex-gap-4v">
      <span className="fr-h4 fr-mb-0 fr-hidden fr-unhidden-sm">{t('residenceCount', { count: accommodations?.count ?? 0 })}</span>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v fr-align-items-md-center">
        <div className="fr-flex fr-justify-content-space-between">
          <span className="fr-h4 fr-mb-0 fr-hidden-sm">{t('residenceCount', { count: accommodations?.count ?? 0 })}</span>
          <ToggleSwitch
            label={t('availableFilter')}
            checked={queryStates.disponible}
            onChange={(checked) => setQueryStates({ disponible: checked })}
            showCheckedHint={false}
            style={{ width: '300px' }}
          />
        </div>
        <SearchInput
          label={t('searchPlaceholder')}
          value={queryStates.recherche}
          onChange={(value) => setQueryStates({ recherche: value || null })}
        />
      </div>
    </div>
  )
}
