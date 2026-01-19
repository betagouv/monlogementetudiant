'use client'

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { type CalculationResult, calculateAllAids } from '~/components/helps-simulator/results/aid-calculator'

const statusOptions = ['student', 'apprentice'] as const
const guarantorOptions = ['yes', 'no', 'unknown'] as const

const formParsers = {
  age: parseAsInteger,
  status: parseAsStringLiteral(statusOptions),
  monthlyIncome: parseAsInteger,
  monthlyRent: parseAsInteger,
  city: parseAsString.withDefault(''),
  hasGuarantor: parseAsStringLiteral(guarantorOptions),
}

export type FormUrlState = {
  age: number | null
  status: (typeof statusOptions)[number] | null
  monthlyIncome: number | null
  monthlyRent: number | null
  city: string
  hasGuarantor: (typeof guarantorOptions)[number] | null
}

export const useHelpSimulatorData = () => {
  const [urlState, setUrlState] = useQueryStates(formParsers, { history: 'push' })

  const formData: HelpSimulatorFormData | null = useMemo(() => {
    if (
      urlState.age === null ||
      urlState.status === null ||
      urlState.monthlyIncome === null ||
      urlState.monthlyRent === null ||
      !urlState.city ||
      urlState.hasGuarantor === null
    ) {
      return null
    }
    return {
      age: urlState.age,
      status: urlState.status,
      monthlyIncome: urlState.monthlyIncome,
      monthlyRent: urlState.monthlyRent,
      city: urlState.city,
      hasGuarantor: urlState.hasGuarantor,
    }
  }, [urlState])

  const results: CalculationResult | null = useMemo(() => {
    if (!formData) return null
    return calculateAllAids(formData)
  }, [formData])

  const clearUrlState = () => {
    setUrlState({
      age: null,
      status: null,
      monthlyIncome: null,
      monthlyRent: null,
      city: '',
      hasGuarantor: null,
    })
  }

  return { formData, urlState, setUrlState, clearUrlState, results }
}
