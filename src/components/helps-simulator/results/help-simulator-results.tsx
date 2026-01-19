'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { FC } from 'react'
import { AidCard } from '~/components/helps-simulator/results/aid-card'
import { useHelpSimulatorData } from '~/components/helps-simulator/use-help-simulator-data'

interface HelpSimulatorResultsProps {
  onRestart: () => void
}

const viewOptions = ['eligible', 'ineligible'] as const

export const HelpSimulatorResults: FC<HelpSimulatorResultsProps> = ({ onRestart }) => {
  const { results } = useHelpSimulatorData()
  const [view, setView] = useQueryState('view', parseAsStringLiteral(viewOptions).withDefault('eligible'))

  if (!results) {
    return null
  }

  const eligibleAids = results.aids.filter((aid) => aid.isEligible)
  const ineligibleAids = results.aids.filter((aid) => !aid.isEligible)

  const displayedAids = view === 'eligible' ? eligibleAids : ineligibleAids

  return (
    <div className="fr-flex fr-direction-column">
      <div className="fr-flex fr-justify-content-center fr-mb-2w">
        <Button priority={view === 'eligible' ? 'secondary' : 'tertiary'} onClick={() => setView('eligible')}>
          Aides disponibles ({eligibleAids.length})
        </Button>
        <Button priority={view === 'ineligible' ? 'secondary' : 'tertiary'} onClick={() => setView('ineligible')}>
          Aides non disponibles ({ineligibleAids.length})
        </Button>
      </div>

      <div className="fr-pt-3w">
        <h3 className="fr-h5 fr-mb-3w">
          {view === 'eligible' ? `Aides disponibles (${eligibleAids.length})` : `Aides non disponibles (${ineligibleAids.length})`}
        </h3>
        {view === 'eligible' && (
          <div className="fr-flex fr-direction-column">
            <span className="fr-text--bold">Important : les montants indiqués sont des estimations.</span>
            <span className="fr-text--sm">Pour connaître vos droits exacts, rendez-vous sur les sites officiels.</span>
          </div>
        )}
        {displayedAids.length > 0 ? (
          <div className="fr-flex fr-direction-column fr-flex-gap-4v">
            {displayedAids.map((aid) => (
              <AidCard key={aid.id} aid={aid} />
            ))}
          </div>
        ) : (
          <p className="fr-text--sm">
            {view === 'eligible' ? 'Aucune aide disponible selon vos critères.' : 'Toutes les aides sont disponibles pour vous.'}
          </p>
        )}
      </div>

      <div className="fr-flex fr-justify-content-center fr-mt-4w">
        <Button priority="secondary" onClick={onRestart}>
          Recommencer
        </Button>
      </div>
    </div>
  )
}
