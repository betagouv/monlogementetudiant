'use client'

import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { type CalculationResult, calculateAllAids } from '~/components/helps-simulator/results/aid-calculator'

const statusOptions = ['student', 'apprentice', 'employed-student', 'lyceen'] as const
const guarantorOptions = ['yes', 'no', 'unknown'] as const
const yesNoUnknownOptions = ['yes', 'no', 'unknown'] as const
const currentYearOptions = ['terminale', 'licence3', 'other'] as const
const professionalLicenceOptions = ['yes', 'no', 'unknown'] as const
const scholarshipOptions = ['bourse-lycee', 'bourse-crous', 'allocation-speciale', 'non'] as const

const formParsers = {
  age: parseAsInteger,
  status: parseAsStringLiteral(statusOptions),
  currentYear: parseAsStringLiteral(currentYearOptions),
  isProfessionalLicence: parseAsStringLiteral(professionalLicenceOptions),
  scholarship: parseAsStringLiteral(scholarshipOptions),
  monthlyIncome: parseAsInteger,
  monthlyRent: parseAsInteger,
  rentUnknown: parseAsBoolean.withDefault(false),
  city: parseAsString.withDefault(''),
  hasGuarantor: parseAsStringLiteral(guarantorOptions),
  changingRegion: parseAsStringLiteral(yesNoUnknownOptions),
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
      currentYear: urlState.currentYear ?? undefined,
      isProfessionalLicence: urlState.isProfessionalLicence ?? undefined,
      scholarship: urlState.scholarship ?? undefined,
      monthlyIncome: urlState.monthlyIncome,
      monthlyRent: urlState.rentUnknown ? undefined : (urlState.monthlyRent ?? undefined),
      rentUnknown: urlState.rentUnknown,
      city: urlState.city,
      hasGuarantor: urlState.hasGuarantor,
      changingRegion: urlState.changingRegion ?? undefined,
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
      currentYear: null,
      isProfessionalLicence: null,
      scholarship: null,
      monthlyIncome: null,
      monthlyRent: null,
      rentUnknown: false,
      city: '',
      hasGuarantor: null,
      changingRegion: null,
    })
  }

  return { formData, urlState, setUrlState, clearUrlState, results }
}
