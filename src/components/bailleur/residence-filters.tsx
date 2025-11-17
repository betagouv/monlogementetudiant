'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs'
import { useMyAccommodations } from '~/hooks/use-my-accommodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

const ResidenceFiltersSkeleton = () => {
  return (
    <>
      <div className="skeleton-rectangle skeleton-rectangle--180" style={{ height: '24px' }} />
      <div className="skeleton-rectangle skeleton-rectangle--400" style={{ height: '40px' }} />
      <div className="skeleton-rectangle skeleton-rectangle--240" style={{ height: '40px' }} />
    </>
  )
}

interface ResidenceFiltersProps {
  initialData: TGetAccomodationsResponse
}

export const ResidenceFilters = ({ initialData }: ResidenceFiltersProps) => {
  const { data: accommodations, isLoading } = useMyAccommodations({ initialData })
  const [queryStates, setQueryStates] = useQueryStates({
    disponible: parseAsBoolean.withDefault(false),
    recherche: parseAsString.withDefault(''),
  })
  const accommodationsList = accommodations?.results.features || []

  if (isLoading) {
    return <ResidenceFiltersSkeleton />
  }

  return (
    <>
      <span className="fr-h4 fr-mb-0">{accommodationsList.length} résidences</span>
      <ToggleSwitch
        label="Logements disponibles"
        checked={queryStates.disponible}
        onChange={(checked) => setQueryStates({ disponible: checked })}
        showCheckedHint={false}
        style={{ width: '300px' }}
      />
      <div className="fr-flex fr-flex-gap-4v">
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
    </>
  )
}
