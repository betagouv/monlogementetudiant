'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'

export const CandidaturesFilters = () => {
  const [queryStates, setQueryStates] = useQueryStates({
    status: parseAsStringLiteral(['pending', 'accepted', 'rejected']).withDefault('pending'),
    recherche: parseAsString.withDefault(''),
    tri: parseAsStringLiteral(['date_desc', 'date_asc']).withDefault('date_desc'),
  })

  return (
    <div className="fr-flex fr-flex-gap-4v fr-my-4w fr-align-items-end">
      <Select
        label=""
        nativeSelectProps={{
          value: queryStates.status,
          onChange: (e) => setQueryStates({ status: e.target.value as 'pending' | 'accepted' | 'rejected' }),
        }}
        className="fr-mb-0"
      >
        <option value="">Tous les statuts</option>
        <option value="pending">A modérer</option>
        <option value="accepted">Accepté</option>
        <option value="rejected">Refusé</option>
      </Select>
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
      <Select
        label=""
        nativeSelectProps={{
          value: queryStates.tri,
          onChange: (e) => setQueryStates({ tri: e.target.value as 'date_desc' | 'date_asc' }),
        }}
        className="fr-mb-0"
      >
        <option value="date_desc">Plus récentes</option>
        <option value="date_asc">Plus anciennes</option>
      </Select>
    </div>
  )
}
