'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'

export const ResidenceFilters = () => {
  return (
    <>
      <ToggleSwitch
        label="Logements disponibles"
        checked={false}
        onChange={() => null}
        showCheckedHint={false}
        style={{ width: '300px' }}
      />
      <div className="fr-flex fr-flex-gap-4v">
        <Input label="" nativeInputProps={{ placeholder: 'Rechercher' }} iconId="ri-search-line" className="fr-mb-0" />
        <Select label="" nativeSelectProps={{ name: 'Filtre' }} className="fr-mb-0">
          <option value="" selected disabled hidden>
            Triés par disponibilités
          </option>

          <option value="1">Disponible</option>
          <option value="2">Occupé</option>
        </Select>
      </div>
    </>
  )
}
