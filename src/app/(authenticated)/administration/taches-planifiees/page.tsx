import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { CronOverviewTable } from '~/components/administration/taches-planifiees/cron-overview-table'

export const metadata = {
  title: 'Tâches planifiées — Administration',
}

export default function TachesPlanifieesPage() {
  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-time-line')} aria-hidden="true" />
          </div>
          <div>
            <h1 className="fr-h3 fr-mb-0">Tâches planifiées</h1>
            <p className="fr-text-mention--grey fr-text--sm fr-mb-0">Monitoring des jobs cron — imports et synchronisations</p>
          </div>
        </div>
      </div>

      <CronOverviewTable />
    </>
  )
}
