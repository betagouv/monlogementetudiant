'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import { FC, useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
  type HelpSimulatorFormData,
  helpSimulatorSchema,
  step1Schema,
  step2Schema,
  step3Schema,
} from '~/components/helps-simulator/help-simulator-schema'
import { HelpSimulatorResults } from '~/components/helps-simulator/results/help-simulator-results'
import { HelpSimulatorStep1 } from '~/components/helps-simulator/steps/help-simulator-step-1'
import { HelpSimulatorStep2 } from '~/components/helps-simulator/steps/help-simulator-step-2'
import { HelpSimulatorStep3 } from '~/components/helps-simulator/steps/help-simulator-step-3'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'
import { trackEvent } from '~/lib/tracking'

const TOTAL_FORM_STEPS = 3

const stepSchemas = {
  1: step1Schema,
  2: step3Schema,
  3: step2Schema,
} as const

const STEP_FIELDS: Record<number, (keyof HelpSimulatorFormData)[]> = {
  1: ['age', 'status'],
  2: ['city', 'hasGuarantor', 'changingRegion', 'boursierLycee'],
  3: ['monthlyIncome', 'monthlyRent', 'rentUnknown'],
}

interface HelpSimulatorFormProps {
  onScrollToTop?: () => void
}

export const HelpSimulatorForm: FC<HelpSimulatorFormProps> = ({ onScrollToTop }) => {
  const [currentStep, setCurrentStep] = useHelpSimulatorStep()
  const { urlState, setUrlState, clearUrlState } = useHelpSimulatorData()

  const form = useForm<HelpSimulatorFormData>({
    resolver: zodResolver(helpSimulatorSchema),
    defaultValues: {
      age: urlState.age ?? undefined,
      status: urlState.status ?? undefined,
      monthlyIncome: urlState.monthlyIncome ?? undefined,
      monthlyRent: urlState.monthlyRent ?? undefined,
      rentUnknown: urlState.rentUnknown ?? false,
      city: urlState.city || '',
      hasGuarantor: urlState.hasGuarantor ?? undefined,
      changingRegion: urlState.changingRegion ?? undefined,
      boursierLycee: urlState.boursierLycee ?? undefined,
    },
  })

  useEffect(() => {
    const currentValues = form.getValues()
    if (urlState.age !== null && urlState.age !== currentValues.age) {
      form.setValue('age', urlState.age)
    }
    if (urlState.status !== null && urlState.status !== currentValues.status) {
      form.setValue('status', urlState.status)
    }
    if (urlState.monthlyIncome !== null && urlState.monthlyIncome !== currentValues.monthlyIncome) {
      form.setValue('monthlyIncome', urlState.monthlyIncome)
    }
    if (urlState.monthlyRent !== null && urlState.monthlyRent !== currentValues.monthlyRent) {
      form.setValue('monthlyRent', urlState.monthlyRent)
    }
    if (urlState.rentUnknown !== currentValues.rentUnknown) {
      form.setValue('rentUnknown', urlState.rentUnknown)
    }
    if (urlState.city && urlState.city !== currentValues.city) {
      form.setValue('city', urlState.city)
    }
    if (urlState.hasGuarantor !== null && urlState.hasGuarantor !== currentValues.hasGuarantor) {
      form.setValue('hasGuarantor', urlState.hasGuarantor)
    }
    if (urlState.changingRegion !== null && urlState.changingRegion !== currentValues.changingRegion) {
      form.setValue('changingRegion', urlState.changingRegion)
    }
    if (urlState.boursierLycee !== null && urlState.boursierLycee !== currentValues.boursierLycee) {
      form.setValue('boursierLycee', urlState.boursierLycee)
    }
  }, [urlState, form])

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleNext = async () => {
    const stepSchema = stepSchemas[currentStep as keyof typeof stepSchemas]
    const values = form.getValues()

    const currentStepFields = STEP_FIELDS[currentStep] || []
    for (const field of currentStepFields) {
      form.clearErrors(field)
    }

    const result = stepSchema.safeParse(values)

    if (!result.success) {
      const issues = values.rentUnknown ? result.error.issues.filter((e) => e.path[0] !== 'monthlyRent') : result.error.issues

      if (issues.length === 0) {
        // All errors were monthlyRent errors skipped because rentUnknown is checked
      } else {
        for (const error of issues) {
          const fieldName = error.path[0] as keyof HelpSimulatorFormData
          form.setError(fieldName, { message: error.message })
        }
        return
      }
    }

    const stepFields = STEP_FIELDS[currentStep] || []
    const urlUpdate: Record<string, unknown> = {}
    for (const field of stepFields) {
      urlUpdate[field] = values[field]
    }
    setUrlState(urlUpdate)

    if (currentStep < TOTAL_FORM_STEPS) {
      const nextStepFields = STEP_FIELDS[currentStep + 1] || []
      for (const field of nextStepFields) {
        form.clearErrors(field)
      }
      if (currentStep === 1) {
        trackEvent({ category: 'Simulateur', action: 'demarrage simulateur aides' })
      }
      trackEvent({ category: 'Simulateur', action: 'etape simulateur aides', name: String(currentStep + 1) })
      setCurrentStep(currentStep + 1)
    } else {
      setUrlState({
        age: values.age,
        status: values.status,
        monthlyIncome: values.monthlyIncome,
        monthlyRent: values.monthlyRent ?? null,
        rentUnknown: values.rentUnknown,
        city: values.city,
        hasGuarantor: values.hasGuarantor,
        changingRegion: values.changingRegion ?? null,
        boursierLycee: values.boursierLycee ?? null,
      })
      trackEvent({ category: 'Simulateur', action: 'completion simulateur aides' })
      setCurrentStep(4)
    }
  }

  const handleRestart = () => {
    trackEvent({ category: 'Simulateur', action: 'redemarrage simulateur aides' })
    form.reset({
      age: undefined,
      status: undefined,
      monthlyIncome: undefined,
      monthlyRent: undefined,
      rentUnknown: false,
      city: '',
      hasGuarantor: undefined,
      changingRegion: undefined,
      boursierLycee: undefined,
    })
    clearUrlState()
    setCurrentStep(1)
    onScrollToTop?.()
  }

  if (currentStep === 4) {
    return <HelpSimulatorResults onRestart={handleRestart} />
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <HelpSimulatorStep1 />
      case 2:
        return <HelpSimulatorStep3 />
      case 3:
        return <HelpSimulatorStep2 />
      default:
        return <HelpSimulatorStep1 />
    }
  }

  return (
    <div>
      <FormProvider {...form}>
        <form>
          <div className="fr-flex fr-direction-column fr-flex-gap-4v">{renderStep()}</div>
          <div className="fr-flex fr-align-items-center fr-pt-3w fr-mt-3w" style={{ borderTop: '1px solid var(--border-default-grey)' }}>
            {currentStep > 1 && (
              <Button type="button" priority="secondary" iconId="ri-arrow-left-line" onClick={handlePrevious}>
                Retour
              </Button>
            )}
            <div style={{ flex: 1 }} />
            <Button type="button" iconId="ri-arrow-right-line" iconPosition="right" onClick={handleNext}>
              {currentStep < TOTAL_FORM_STEPS ? 'Continuer' : 'Voir les résultats'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
