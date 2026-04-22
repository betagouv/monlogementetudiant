import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { CsvImportForm } from '~/components/administration/imports/csv-import-form'
import { JobHistoryList } from '~/components/administration/imports/job-history-list'

export const metadata = {
  title: 'Imports — Administration',
}

export default function ImportsPage() {
  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-upload-2-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Imports</h1>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Nouvel import CSV</span>
        </div>
        <div className="fr-p-3w">
          <CsvImportForm />
        </div>
      </div>

      <div className="fr-mt-3w">
        <JobHistoryList />
      </div>
    </>
  )
}
