'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'

export const CandidaturesFilters = () => {
  return (
    <>
      <div className="fr-flex fr-flex-gap-4v">
        <Select label="" nativeSelectProps={{ name: 'Filtre' }} className="fr-mb-0">
          <option value="" selected disabled hidden>
            Tous les status
          </option>

          <option value="1">A modérer</option>
          <option value="2">Accepté</option>
          <option value="3">Refusé</option>
        </Select>
        <Input label="" nativeInputProps={{ placeholder: 'Rechercher' }} iconId="ri-search-line" className="fr-mb-0" />
        <Select label="" nativeSelectProps={{ name: 'Filtre' }} className="fr-mb-0">
          <option value="" selected disabled hidden>
            Triés par date
          </option>

          <option value="1">Disponible</option>
          <option value="2">Occupé</option>
        </Select>
      </div>
    </>
  )
}
