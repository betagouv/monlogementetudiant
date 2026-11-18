'use client'

import Select from '@codegouvfr/react-dsfr/Select'
import { parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { defaultMonthRange } from '~/server/admin-metrics/months'
import { useMonthOptions } from './month-range-filter'

export const useMonth = (): [string, (month: string) => void] => {
  const fallback = useMemo(() => defaultMonthRange().to, [])
  const [month, setMonth] = useQueryState('mois', parseAsString.withDefault(fallback))
  return [month, (value) => setMonth(value)]
}

export const MonthFilter = ({ month, onChange }: { month: string; onChange: (month: string) => void }) => {
  const options = useMonthOptions()
  return (
    <div className="fr-grid-row fr-grid-row--gutters">
      <div className="fr-col-12 fr-col-md-4">
        <Select label="Mois" nativeSelectProps={{ value: month, onChange: (e) => onChange(e.target.value) }}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
