'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ACTION_COLORS, ACTION_LABELS } from '~/utils/activity-actions'
import { formatRelativeDate } from '~/utils/date-helpers'
import styles from './activity-item.module.css'

type ActivityEntry = {
  id: number
  createdAt: Date | string
  userName: string | null
  action: string
  entityName: string | null
  ownerName?: string | null
  metadata: unknown
}

export function ActivityItem({ item, showOwner = false }: { item: ActivityEntry; showOwner?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const meta = item.metadata as { diff?: Record<string, { old: unknown; new: unknown }>; slug?: string } | null
  const hasDiff = meta?.diff && Object.keys(meta.diff).length > 0

  return (
    <div>
      <div className={styles.row} style={{ cursor: hasDiff ? 'pointer' : undefined }} onClick={() => hasDiff && setExpanded(!expanded)}>
        <div className={styles.dot} style={{ background: ACTION_COLORS[item.action] ?? 'var(--text-mention-grey)' }} />
        <div className={styles.content}>
          <div>
            <span className="fr-text--sm fr-text--bold">{ACTION_LABELS[item.action] ?? item.action}</span>
            {item.entityName && meta?.slug ? (
              <>
                <span className="fr-text--xs fr-mb-0"> — </span>
                <Link href={`/bailleur/residences/${meta.slug}`} className="fr-text--sm fr-link" onClick={(e) => e.stopPropagation()}>
                  {item.entityName}
                </Link>
              </>
            ) : item.entityName ? (
              <span className="fr-text--sm"> — {item.entityName}</span>
            ) : null}
          </div>
          <div className="fr-text--xs fr-text-mention--grey fr-mb-0">
            {item.userName ?? 'Systeme'}
            {showOwner && item.ownerName && ` (${item.ownerName})`}
            {' — '}
            {formatRelativeDate(String(item.createdAt))}
          </div>
        </div>
        {hasDiff && <span className={styles.toggle}>{expanded ? '−' : '+'}</span>}
      </div>
      {expanded && meta?.diff && (
        <div className={styles.diffPanel}>
          <table className={styles.diffTable}>
            <thead>
              <tr>
                <th>Champ</th>
                <th>Avant</th>
                <th>Apres</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(meta.diff).map(([field, { old: oldVal, new: newVal }]) => (
                <tr key={field}>
                  <td className={styles.diffField}>{field}</td>
                  <td className={styles.diffOld}>{oldVal == null ? '—' : String(oldVal)}</td>
                  <td className={styles.diffNew}>{newVal == null ? '—' : String(newVal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
