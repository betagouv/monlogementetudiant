import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'

type JobStatCardsProps = {
  created?: number
  updated?: number
  skipped?: number
  errors?: string[]
  labels?: {
    created?: string
    updated?: string
    skipped?: string
    errors?: string
  }
}

export function JobStatCards({ created, updated, skipped, errors, labels = {} }: JobStatCardsProps) {
  const errorCount = errors?.length ?? 0
  const showCreated = created != null
  const showSkipped = skipped != null
  const cols = (showCreated ? 1 : 0) + 1 + (showSkipped ? 1 : 0) + 1
  const gridClass = cols === 3 ? styles.statsGrid3 : styles.statsGrid4

  return (
    <div className={clsx(styles.statsGrid, gridClass)}>
      {showCreated && (
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>{labels.created ?? 'Créés'}</div>
          <div className={styles.statValue}>{created}</div>
        </div>
      )}
      <div className={clsx(styles.statCard, styles.statCardBlue)}>
        <div className={styles.statLabel}>{labels.updated ?? 'Mis à jour'}</div>
        <div className={styles.statValue}>{updated ?? 0}</div>
      </div>
      {showSkipped && (
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>{labels.skipped ?? 'Ignorés'}</div>
          <div className={styles.statValue}>{skipped}</div>
        </div>
      )}
      <div className={clsx(styles.statCard, errorCount > 0 ? styles.statCardOrange : styles.statCardBlue)}>
        <div className={styles.statLabel}>{labels.errors ?? 'Erreurs'}</div>
        <div className={styles.statValue}>{errorCount}</div>
      </div>
    </div>
  )
}
