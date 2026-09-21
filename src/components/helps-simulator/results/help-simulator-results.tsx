'use client'

import { Alert } from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { FC } from 'react'
import { AidsResults } from '~/components/helps-simulator/results/aids-results-view'
import { SaveSimulationBanner } from '~/components/helps-simulator/results/save-simulation-banner'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'

interface HelpSimulatorResultsProps {
  onRestart: () => void
}

const viewOptions = ['eligible', 'ineligible'] as const

export const HelpSimulatorResults: FC<HelpSimulatorResultsProps> = ({ onRestart }) => {
  const t = useTranslations('simulator.results')
  const { formData, results } = useHelpSimulatorData()
  const [view, setView] = useQueryState('view', parseAsStringLiteral(viewOptions).withDefault('eligible'))

  if (!results || !formData) {
    return null
  }

  return (
    <div className="fr-flex fr-direction-column">
      {formData.isInternationalStudent && (
        <Alert className="fr-mb-4w" severity="warning" small description={t('internationalStudentWarning')} />
      )}

      <AidsResults results={results} view={view} onViewChange={setView} />

      <SaveSimulationBanner formData={formData} />

      <div className="fr-flex fr-justify-content-center fr-mt-4w">
        <Button priority="tertiary" onClick={onRestart}>
          {t('restart')}
        </Button>
      </div>
    </div>
  )
}
