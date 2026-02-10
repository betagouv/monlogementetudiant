'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'

export const CandidaturesFilters = () => {
  return (
    <>
      <div className="fr-flex fr-flex-gap-4v">
        <Select
          label={<span className="fr-sr-only">Filtrer par statut</span>}
          nativeSelectProps={{ name: 'Filtre', defaultValue: '' }}
          className="fr-mb-0"
        >
          <option value="" disabled hidden>
            Tous les status
          </option>

          <option value="1">A modérer</option>
          <option value="2">Accepté</option>
          <option value="3">Refusé</option>
        </Select>
        <Input
          label="Rechercher une candidature"
          hideLabel
          nativeInputProps={{ placeholder: 'Rechercher' }}
          iconId="ri-search-line"
          className="fr-mb-0"
        />
        <Select
          label={<span className="fr-sr-only">Trier les candidatures</span>}
          nativeSelectProps={{ name: 'Filtre', defaultValue: '' }}
          className="fr-mb-0"
        >
          <option value="" disabled hidden>
            Triés par date
          </option>

          <option value="1">Disponible</option>
          <option value="2">Occupé</option>
        </Select>
      </div>
    </>
  )
}
