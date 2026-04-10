'use client'

import Pagination from '@codegouvfr/react-dsfr/Pagination'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { ActivityItem } from '~/components/administration/activity-item'
import { useTRPC } from '~/server/trpc/client'
import { ACTION_LABELS, ALL_ACTIONS } from '~/utils/activity-actions'
import styles from '../administration.module.css'
import statStyles from '../statistiques/statistiques.module.css'

export default function JournauxPage() {
  const trpc = useTRPC()
  const [qs, setQs] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    action: parseAsString,
  })

  const { data, isLoading } = useQuery(
    trpc.admin.ownerUsage.activityLog.queryOptions({
      page: qs.page,
      action: qs.action ?? undefined,
    }),
  )

  const items = data?.items ?? []

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-article-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Journaux d&apos;activité</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Historique des actions sur la plateforme</p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <div className={statStyles.dateRangeBar}>
            <span className="fr-text--sm fr-mb-0 fr-text--bold">Action :</span>
            <div className={statStyles.dateRangePresets} style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className={!qs.action ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                onClick={() => void setQs({ action: null, page: 1 })}
              >
                Toutes
              </button>
              {ALL_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={qs.action === action ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                  onClick={() => void setQs({ action: qs.action === action ? null : action, page: 1 })}
                >
                  {ACTION_LABELS[action] ?? action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{data ? `${data.total} activité(s)` : 'Chargement...'}</span>
        </div>
        {isLoading ? (
          <div className="fr-p-4w fr-text--sm fr-text-mention--grey" style={{ textAlign: 'center' }}>
            Chargement...
          </div>
        ) : items.length === 0 ? (
          <div className="fr-p-4w fr-text--sm fr-text-mention--grey" style={{ textAlign: 'center' }}>
            Aucune activité enregistrée
          </div>
        ) : (
          <>
            {items.map((item) => (
              <ActivityItem key={item.id} item={item} showOwner />
            ))}
            {data && data.pageCount > 1 && (
              <div className="fr-p-2w fr-flex fr-justify-content-center">
                <Pagination
                  count={data.pageCount}
                  defaultPage={qs.page}
                  getPageLinkProps={(p) => ({
                    href: '#',
                    onClick: (e: React.MouseEvent) => {
                      e.preventDefault()
                      void setQs({ page: p })
                    },
                  })}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
