'use client'

import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { type CalculationResult, calculateAllAids } from '~/components/helps-simulator/results/aid-calculator'

const statusOptions = ['student', 'apprentice', 'employed-student'] as const
const guarantorOptions = ['yes', 'no', 'unknown'] as const
const yesNoOptions = ['yes', 'no'] as const

const formParsers = {
  age: parseAsInteger,
  status: parseAsStringLiteral(statusOptions),
  monthlyIncome: parseAsInteger,
  monthlyRent: parseAsInteger,
  rentUnknown: parseAsBoolean.withDefault(false),
  city: parseAsString.withDefault(''),
  hasGuarantor: parseAsStringLiteral(guarantorOptions),
  changingRegion: parseAsStringLiteral(yesNoOptions),
  boursierLycee: parseAsStringLiteral(yesNoOptions),
}

export type FormUrlState = {
  age: number | null
  status: (typeof statusOptions)[number] | null
  monthlyIncome: number | null
  monthlyRent: number | null
  rentUnknown: boolean
  city: string
  hasGuarantor: (typeof guarantorOptions)[number] | null
  changingRegion: (typeof yesNoOptions)[number] | null
  boursierLycee: (typeof yesNoOptions)[number] | null
}

export const useHelpSimulatorData = () => {
  const [urlState, setUrlState] = useQueryStates(formParsers, { history: 'push' })

  const formData: HelpSimulatorFormData | null = useMemo(() => {
    if (
      urlState.age === null ||
      urlState.status === null ||
      urlState.monthlyIncome === null ||
      (!urlState.rentUnknown && urlState.monthlyRent === null) ||
      !urlState.city ||
      urlState.hasGuarantor === null
    ) {
      return null
    }
    return {
      age: urlState.age,
      status: urlState.status,
      monthlyIncome: urlState.monthlyIncome,
      monthlyRent: urlState.rentUnknown ? undefined : (urlState.monthlyRent ?? undefined),
      rentUnknown: urlState.rentUnknown,
      city: urlState.city,
      hasGuarantor: urlState.hasGuarantor,
      changingRegion: urlState.changingRegion ?? undefined,
      boursierLycee: urlState.boursierLycee ?? undefined,
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
      rentUnknown: false,
      city: '',
      hasGuarantor: null,
      changingRegion: null,
      boursierLycee: null,
    })
  }

  return { formData, urlState, setUrlState, clearUrlState, results }
}
