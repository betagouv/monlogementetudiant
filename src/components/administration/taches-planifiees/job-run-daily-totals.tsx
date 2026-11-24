'use client'

import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { Pagination } from '~/components/ui/pagination'
import { useTRPC } from '~/server/trpc/client'
import { formatMetrics } from './job-run-status-badge'

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

export function JobRunDailyTotals({ identifier }: { identifier: string }) {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery(trpc.admin.jobRuns.dailyTotals.queryOptions({ identifier, page }))

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Totaux par jour</span>
          <span className="fr-text-mention--grey fr-text--sm">{data?.total ?? 0} jours</span>
        </div>
        <div className={clsx('fr-table', styles.tableWrapper)}>
          <table>
            <thead>
              <tr>
                <th scope="col">Jour (heure de Paris)</th>
                <th scope="col">Exécutions</th>
                <th scope="col">En erreur</th>
                <th scope="col">Compteurs</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="fr-text-mention--grey">
                    Chargement…
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="fr-text-mention--grey">
                    Aucune exécution enregistrée.
                  </td>
                </tr>
              )}
              {data?.items.map((item) => (
                <tr key={item.day}>
                  <td className="fr-text--sm">{formatDay(item.day)}</td>
                  <td className="fr-text--sm">{item.runs}</td>
                  <td className={clsx('fr-text--sm', item.errors > 0 && 'fr-text-default-error')}>{item.errors}</td>
                  <td className="fr-text--sm">{formatMetrics(item.metrics) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(data?.pageCount ?? 0) > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={data!.pageCount}
          defaultPage={page}
          getPageLinkProps={(pageNumber) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              setPage(pageNumber)
            },
          })}
        />
      )}
    </>
  )
}
