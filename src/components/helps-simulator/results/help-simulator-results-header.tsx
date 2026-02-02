'use client'

import clsx from 'clsx'
import { FC } from 'react'
import { ZONE_LABELS } from '~/components/helps-simulator/results/zone-utils'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'
import styles from './help-simulator-header-results.module.css'

export const HelpSimulatorHeaderResults: FC = () => {
  const [currentStep] = useHelpSimulatorStep()
  const { results } = useHelpSimulatorData()

  if (currentStep !== 4 || !results) {
    return null
  }

  return (
    <div className="boxShadow fr-py-3w fr-px-8w">
      <h2 className="fr-h3 fr-mb-3w">Résultats de votre simulation</h2>

      <div className="fr-flex fr-align-items-center fr-mb-3w">
        <div className="fr-flex fr-flex-gap-2v">
          <span className="fr-text--bold fr-text--sm fr-mb-0">Localisation</span>
          <span className={clsx('fr-text--sm fr-mb-0', styles.localisationContainer)}>{ZONE_LABELS[results.zone]}</span>
        </div>
      </div>

      {results.localAids.length > 0 && (
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-border-top fr-pt-3w">
          <span className="ri-information-line" aria-hidden="true" />
          <span>
            <strong>{results.localAids[0]}</strong> propose des aides complémentaires pour les étudiants
          </span>
        </div>
      )}
    </div>
  )
}
