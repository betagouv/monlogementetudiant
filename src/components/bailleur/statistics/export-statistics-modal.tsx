'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { TStatisticsPeriod } from '~/server/statistics/accommodation-stats'

const PERIODS: TStatisticsPeriod[] = ['7d', '30d', '90d']

const exportStatisticsModal = createModal({
  id: 'export-statistics-modal',
  isOpenedByDefault: false,
})

/**
 * Extraction CSV des statistiques de toutes les résidences du gestionnaire.
 *
 * La période est redemandée dans la modale plutôt que reprise de celle affichée : le fichier part
 * sur le poste du gestionnaire et y sera relu hors contexte, mieux vaut donc qu'il ait choisi la
 * période explicitement.
 */
export function ExportStatisticsModal({ ownerId, currentPeriod }: { ownerId?: number; currentPeriod: TStatisticsPeriod }) {
  const t = useTranslations('bailleur.dashboard.engagementStatistics')
  const [period, setPeriod] = useState<TStatisticsPeriod>(currentPeriod)

  const params = new URLSearchParams({ period })
  if (ownerId) params.set('ownerId', String(ownerId))

  return (
    <>
      <Button priority="secondary" size="small" iconId="fr-icon-download-line" onClick={() => exportStatisticsModal.open()}>
        {t('export.cta')}
      </Button>

      <exportStatisticsModal.Component
        title={t('export.title')}
        buttons={[
          { children: t('export.cancel'), priority: 'secondary', doClosesModal: true },
          {
            children: t('export.submit'),
            iconId: 'fr-icon-download-line',
            // Un vrai lien plutôt qu'un bouton : le téléchargement reste ouvrable dans un nouvel
            // onglet, et `doClosesModal` referme la modale sans avoir à y greffer un `onClick`.
            linkProps: { href: `/api/bailleur/statistiques/export?${params.toString()}` },
            doClosesModal: true,
          },
        ]}
      >
        <p className="fr-text--sm fr-text-mention--grey">{t('export.description')}</p>
        <RadioButtons
          legend={t('export.periodLegend')}
          name="export-period"
          options={PERIODS.map((value) => ({
            label: t(`period.${value}` as 'period.7d' | 'period.30d' | 'period.90d'),
            nativeInputProps: {
              value,
              checked: period === value,
              onChange: () => setPeriod(value),
            },
          }))}
        />
      </exportStatisticsModal.Component>
    </>
  )
}
