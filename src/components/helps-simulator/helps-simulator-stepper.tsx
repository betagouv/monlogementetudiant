'use client'

import { Stepper } from '@codegouvfr/react-dsfr/Stepper'
import { FC } from 'react'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'

const STEPS = [
  { title: 'Votre profil', nextTitle: 'Votre situation financière' },
  { title: 'Votre situation financière', nextTitle: 'Votre logement' },
  { title: 'Votre logement', nextTitle: 'Résultats' },
] as const

export const HelpsSimulatorStepper: FC = () => {
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
      title={step.title}
      nextTitle={stepIndex < STEPS.length - 1 ? step.nextTitle : undefined}
    />
  )
}
