'use client'

import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { AidsLocalisationInfo } from '~/components/helps-simulator/results/aids-localisation-info'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'

export const HelpSimulatorHeaderResults: FC = () => {
  const t = useTranslations('simulator.results')
  const [currentStep] = useHelpSimulatorStep()
  const { results } = useHelpSimulatorData()

  if (currentStep !== 4 || !results) {
    return null
  }

  return (
    <div className="boxShadow fr-py-3w fr-px-8w">
      <h2 className="fr-h3 fr-mb-3w">{t('title')}</h2>
      <AidsLocalisationInfo results={results} />
    </div>
  )
}
