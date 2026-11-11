'use client'

import clsx from 'clsx'
import { MonthRangeFilter, useMonthRange } from '~/components/administration/metrics/month-range-filter'
import { MonthlyMetricsTable } from '~/components/administration/metrics/monthly-metrics-table'
import { useAdminMetricsStudents } from '~/hooks/use-admin-metrics'
import styles from '../administration.module.css'

export default function UsageEtudiantsPage() {
  const [range, setRange] = useMonthRange()
  const { data, isLoading, isError } = useAdminMetricsStudents(range)

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-user-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Usage étudiants</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Suivi mensuel de l&apos;usage de la plateforme par les étudiants</p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <MonthRangeFilter range={range} onChange={setRange} />
          {isLoading && <p>Chargement...</p>}
          {isError && <p className="fr-error-text">Période invalide ou données indisponibles</p>}
          {data && <MonthlyMetricsTable series={data} range={range} />}
        </div>
      </div>
    </>
  )
}
