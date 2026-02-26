'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs'
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
      <span className="fr-h4 fr-mb-0 fr-hidden fr-unhidden-sm">{accommodations?.count ?? 0} résidences</span>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v fr-align-items-md-center">
        <div className="fr-flex fr-justify-content-space-between">
          <span className="fr-h4 fr-mb-0 fr-hidden-sm">{accommodations?.count ?? 0} résidences</span>
          <ToggleSwitch
            label="Logements disponibles"
            checked={queryStates.disponible}
            onChange={(checked) => setQueryStates({ disponible: checked })}
            showCheckedHint={false}
            style={{ width: '300px' }}
          />
        </div>
        <Input
          label=""
          nativeInputProps={{
            placeholder: 'Rechercher',
            value: queryStates.recherche,
            onChange: (e) => setQueryStates({ recherche: e.target.value }),
          }}
          iconId="ri-search-line"
          className="fr-mb-0"
        />
        {/* <Select label="" nativeSelectProps={{ name: 'Filtre' }} className="fr-mb-0">
          <option value="" selected disabled hidden>
            Triés par disponibilités
          </option>

          <option value="1">Disponible</option>
          <option value="2">Occupé</option>
        </Select> */}
      </div>
    </div>
  )
}
