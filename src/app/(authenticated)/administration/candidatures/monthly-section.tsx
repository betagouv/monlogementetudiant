'use client'

import clsx from 'clsx'
import { MonthRangeFilter, useMonthRange } from '~/components/administration/metrics/month-range-filter'
import { MonthlyMetricsTable } from '~/components/administration/metrics/monthly-metrics-table'
import { useAdminMetricsCandidatures } from '~/hooks/use-admin-metrics'
import styles from '../administration.module.css'

export const CandidaturesMonthlySection = () => {
  const [range, setRange] = useMonthRange()
  const { data, isLoading, isError } = useAdminMetricsCandidatures(range)

  return (
    <section className={clsx(styles.card, 'fr-mb-3w')} aria-labelledby="evolution-mensuelle">
      <div className={styles.cardHeader}>
        <h2 id="evolution-mensuelle" className={clsx(styles.cardTitle, 'fr-mb-0')}>
          Évolution mensuelle
        </h2>
      </div>
      <div className="fr-p-2w">
        <MonthRangeFilter range={range} onChange={setRange} />
        <p className="fr-text--sm fr-text-mention--grey">Données mises à jour chaque nuit</p>
        {isLoading && <p>Chargement...</p>}
        {isError && <p className="fr-error-text">Période invalide ou données indisponibles</p>}
        {data && <MonthlyMetricsTable series={data} range={range} />}
      </div>
    </section>
  )
}
