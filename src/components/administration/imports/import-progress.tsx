'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { ProgressLine } from '~/server/lib/import/csv-importer'

type Props = {
  total: number
  current: number
  lines: ProgressLine[]
  done: boolean
  summary?: {
    created?: number
    updated?: number
    skipped?: number
    errors?: string[]
  }
}

function actionBadge(action: ProgressLine['action']) {
  if (action === 'created') return <Badge severity="success">Créée</Badge>
  if (action === 'updated') return <Badge severity="info">Mise à jour</Badge>
  if (action === 'skipped') return <Badge>Ignorée</Badge>
  if (action === 'error') return <Badge severity="error">Erreur</Badge>
  return null
}

export function ImportProgress({ total, current, lines, done, summary }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div>
      <div className="fr-mb-2w">
        <div className="fr-flex fr-justify-content-space-between fr-mb-1v">
          <span className="fr-text--sm">{done ? 'Import terminé' : `Traitement en cours… ${current} / ${total}`}</span>
          <span className="fr-text--sm fr-text--bold">{pct}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={clsx(styles.progressFill, done && styles.progressFillDone)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {done && summary && (
        <div className="fr-flex fr-flex-gap-3v fr-mb-3w">
          <div className={clsx(styles.statCard, styles.statCardGreen, 'fr-p-2w')}>
            <div className={styles.statLabel}>Créées</div>
            <div className={styles.statValue}>{summary.created ?? 0}</div>
          </div>
          <div className={clsx(styles.statCard, styles.statCardBlue, 'fr-p-2w')}>
            <div className={styles.statLabel}>Mises à jour</div>
            <div className={styles.statValue}>{summary.updated ?? 0}</div>
          </div>
          {(summary.errors?.length ?? 0) > 0 && (
            <div className={clsx(styles.statCard, styles.statCardOrange, 'fr-p-2w')}>
              <div className={styles.statLabel}>Erreurs</div>
              <div className={styles.statValue}>{summary.errors!.length}</div>
            </div>
          )}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Journal</span>
        </div>
        <div className={styles.logScroll}>
          {lines.map((line) => (
            <div key={line.row} className={styles.activityItem}>
              <div
                className={clsx(
                  line.action === 'error'
                    ? styles.activityDotError
                    : line.action === 'created'
                      ? styles.activityDotSuccess
                      : line.action === 'updated'
                        ? styles.activityDotInfo
                        : styles.activityDotNeutral,
                )}
              />
              <div className={styles.activityText}>
                <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
                  <span className="fr-text--sm fr-text-mention--grey">#{line.row}</span>
                  <span>{line.name}</span>
                  {actionBadge(line.action)}
                </div>
                {line.message && <p className="fr-text--sm fr-text-default-error fr-mb-0">{line.message}</p>}
              </div>
            </div>
          ))}
          {!done && lines.length === 0 && <div className="fr-p-3w fr-text-mention--grey fr-text--center">En attente...</div>}
        </div>
      </div>
    </div>
  )
}
