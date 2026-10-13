'use client'

import { Stepper } from '@codegouvfr/react-dsfr/Stepper'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'

const STEPS = [
  { title: 'profile', nextTitle: 'housingSearch' },
  { title: 'housingSearch', nextTitle: 'financialSituation' },
  { title: 'financialSituation', nextTitle: 'results' },
] as const

export const HelpsSimulatorStepper: FC = () => {
  const t = useTranslations('simulator.stepper')
  const [currentStep] = useHelpSimulatorStep()
  if (currentStep > 3) return null

  if (currentStep > STEPS.length) {
    return null
  }

  const stepIndex = Math.min(Math.max(currentStep - 1, 0), STEPS.length - 1)
  const step = STEPS[stepIndex]

  return (
    <Stepper
      currentStep={currentStep}
      className="fr-py-3w fr-px-8w fr-mb-0 boxShadow"
      stepCount={STEPS.length}
      title={t(step.title)}
      nextTitle={stepIndex < STEPS.length - 1 ? t(step.nextTitle) : undefined}
    />
  )
}
