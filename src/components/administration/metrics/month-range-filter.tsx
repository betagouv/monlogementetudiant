'use client'

import Select from '@codegouvfr/react-dsfr/Select'
import { addMonths, format } from 'date-fns'
import { parseAsString, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { defaultMonthRange, listMonths } from '~/server/admin-metrics/months'

const AVAILABLE_MONTHS = 36

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

export const useMonthRange = (): [TMonthRange, (range: Partial<TMonthRange>) => void] => {
  const defaults = useMemo(() => defaultMonthRange(), [])
  const [qs, setQs] = useQueryStates({
    from: parseAsString.withDefault(defaults.from),
    to: parseAsString.withDefault(defaults.to),
  })
  return [{ from: qs.from, to: qs.to }, (range) => setQs(range)]
}

export const useMonthOptions = () =>
  useMemo(() => {
    const current = new Date(`${defaultMonthRange().to}-01T00:00:00`)
    const months = listMonths({ from: format(addMonths(current, -(AVAILABLE_MONTHS - 1)), 'yyyy-MM'), to: format(current, 'yyyy-MM') })
    return months.reverse().map((month) => ({ value: month, label: monthLabel(month) }))
  }, [])

export const MonthRangeFilter = ({ range, onChange }: { range: TMonthRange; onChange: (range: Partial<TMonthRange>) => void }) => {
  const options = useMonthOptions()

  return (
    <div className="fr-grid-row fr-grid-row--gutters">
      <div className="fr-col-12 fr-col-md-4">
        <Select label="Du mois" nativeSelectProps={{ value: range.from, onChange: (e) => onChange({ from: e.target.value }) }}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="fr-col-12 fr-col-md-4">
        <Select label="Au mois" nativeSelectProps={{ value: range.to, onChange: (e) => onChange({ to: e.target.value }) }}>
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
