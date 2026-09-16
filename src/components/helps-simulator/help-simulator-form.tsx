'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { createHelpSimulatorSchemas, type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { HelpSimulatorResults } from '~/components/helps-simulator/results/help-simulator-results'
import { HelpSimulatorStep1 } from '~/components/helps-simulator/steps/help-simulator-step-1'
import { HelpSimulatorStep2 } from '~/components/helps-simulator/steps/help-simulator-step-2'
import { HelpSimulatorStep3 } from '~/components/helps-simulator/steps/help-simulator-step-3'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'
import { LiveRegion } from '~/components/ui/live-region'
import { RequiredFieldsNotice } from '~/components/ui/required-mark'
import { trackEvent } from '~/lib/tracking'

const TOTAL_FORM_STEPS = 3

const STEP_TITLE_KEYS: Record<number, 'situation' | 'housing' | 'resources'> = {
  1: 'situation',
  2: 'housing',
  3: 'resources',
}

const STEP_FIELDS: Record<number, (keyof HelpSimulatorFormData)[]> = {
  1: ['age', 'status', 'isInternationalStudent', 'currentYear', 'isProfessionalLicence', 'scholarship', 'changingRegion'],
  2: ['city', 'hasGuarantor'],
  3: ['monthlyIncome', 'monthlyRent', 'rentUnknown'],
}

interface HelpSimulatorFormProps {
  onScrollToTop?: () => void
}

export const HelpSimulatorForm: FC<HelpSimulatorFormProps> = ({ onScrollToTop }) => {
  const t = useTranslations('simulator.form')
  const tErrors = useTranslations('simulator.form.errors')
  const { helpSimulatorSchema, step1Schema, step2Schema, step3Schema } = useMemo(
    () => createHelpSimulatorSchemas((key) => tErrors(key)),
    [tErrors],
  )
  const [currentStep, setCurrentStep] = useHelpSimulatorStep()
  const { urlState, setUrlState, clearUrlState } = useHelpSimulatorData()
  const [errorSummary, setErrorSummary] = useState<string[]>([])
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(currentStep)

  // Le passage d'une étape à l'autre remplace tout le contenu du formulaire sans rien annoncer
  // ni déplacer le focus : on le pose sur le titre de la nouvelle étape (RGAA 7.5, 12.x).
  useEffect(() => {
    if (previousStep.current === currentStep) return
    previousStep.current = currentStep
    setErrorSummary([])
    stepHeadingRef.current?.focus()
  }, [currentStep])

  // Le résumé n'existe dans le DOM qu'après le rendu : le focus ne peut donc pas être posé
  // depuis le gestionnaire de soumission.
  useEffect(() => {
    if (errorSummary.length > 0) errorSummaryRef.current?.focus()
  }, [errorSummary])

  const form = useForm<HelpSimulatorFormData>({
    resolver: zodResolver(helpSimulatorSchema),
    defaultValues: {
      age: urlState.age ?? undefined,
      status: urlState.status ?? undefined,
      isInternationalStudent: urlState.isInternationalStudent ?? false,
      currentYear: urlState.currentYear ?? undefined,
      isProfessionalLicence: urlState.isProfessionalLicence ?? undefined,
      scholarship: urlState.scholarship ?? undefined,
      monthlyIncome: urlState.monthlyIncome ?? undefined,
      monthlyRent: urlState.monthlyRent ?? undefined,
      rentUnknown: urlState.rentUnknown ?? false,
      city: urlState.city || '',
      hasGuarantor: urlState.hasGuarantor ?? undefined,
      changingRegion: urlState.changingRegion ?? undefined,
    },
  })

  useEffect(() => {
    const currentValues = form.getValues()
    if (urlState.age !== null && urlState.age !== currentValues.age) {
      form.setValue('age', urlState.age)
    }
    if (urlState.status !== null && JSON.stringify(urlState.status) !== JSON.stringify(currentValues.status)) {
      form.setValue('status', urlState.status)
    }
    if (urlState.isInternationalStudent !== currentValues.isInternationalStudent) {
      form.setValue('isInternationalStudent', urlState.isInternationalStudent)
    }
    if (urlState.currentYear !== null && urlState.currentYear !== currentValues.currentYear) {
      form.setValue('currentYear', urlState.currentYear)
    }
    if (urlState.isProfessionalLicence !== null && urlState.isProfessionalLicence !== currentValues.isProfessionalLicence) {
      form.setValue('isProfessionalLicence', urlState.isProfessionalLicence)
    }
    if (urlState.scholarship !== null && urlState.scholarship !== currentValues.scholarship) {
      form.setValue('scholarship', urlState.scholarship)
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
  }, [urlState, form])

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleNext = async () => {
    const stepSchemas = { 1: step1Schema, 2: step3Schema, 3: step2Schema } as const
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
        // Sans ce résumé, un lecteur d'écran ne restituait rien après un clic sur « Continuer » :
        // les messages posés par setError ne sont ni annoncés ni atteints par le focus (RGAA 7.5, 11.10).
        setErrorSummary(issues.map((issue) => issue.message))
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
        isInternationalStudent: values.isInternationalStudent ?? false,
        currentYear: values.currentYear ?? null,
        isProfessionalLicence: values.isProfessionalLicence ?? null,
        scholarship: values.scholarship ?? null,
        monthlyIncome: values.monthlyIncome,
        monthlyRent: values.monthlyRent ?? null,
        rentUnknown: values.rentUnknown,
        city: values.city,
        hasGuarantor: values.hasGuarantor,
        changingRegion: values.changingRegion ?? null,
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
      isInternationalStudent: false,
      currentYear: undefined,
      isProfessionalLicence: undefined,
      scholarship: undefined,
      monthlyIncome: undefined,
      monthlyRent: undefined,
      rentUnknown: false,
      city: '',
      hasGuarantor: undefined,
      changingRegion: undefined,
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

  const stepTitleKey = STEP_TITLE_KEYS[currentStep]
  const stepTitle = stepTitleKey ? t(`stepTitles.${stepTitleKey}`) : ''

  return (
    <div>
      <FormProvider {...form}>
        <form>
          <h2 className="fr-h5" ref={stepHeadingRef} tabIndex={-1}>
            {stepTitle}
            <span className="fr-sr-only"> {t('stepProgress', { current: currentStep, total: TOTAL_FORM_STEPS })}</span>
          </h2>
          <LiveRegion message={t('stepAnnouncement', { current: currentStep, total: TOTAL_FORM_STEPS, title: stepTitle })} />
          <RequiredFieldsNotice />
          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              role="alert"
              className="fr-alert fr-alert--error fr-mb-3w"
              aria-labelledby="simulateur-erreurs-titre"
            >
              <h3 className="fr-alert__title" id="simulateur-erreurs-titre">
                {t('errorSummaryTitle', { count: errorSummary.length })}
              </h3>
              <ul>
                {errorSummary.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="fr-flex fr-direction-column fr-flex-gap-4v">{renderStep()}</div>
          <div className="fr-flex fr-align-items-center fr-pt-3w fr-mt-3w" style={{ borderTop: '1px solid var(--border-default-grey)' }}>
            {currentStep > 1 && (
              <Button type="button" priority="secondary" iconId="ri-arrow-left-line" onClick={handlePrevious}>
                {t('previous')}
              </Button>
            )}
            <div style={{ flex: 1 }} />
            <Button type="button" iconId="ri-arrow-right-line" iconPosition="right" onClick={handleNext}>
              {currentStep < TOTAL_FORM_STEPS ? t('next') : t('seeResults')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
