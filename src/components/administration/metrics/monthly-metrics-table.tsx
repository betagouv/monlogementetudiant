'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip'
import { METRIC_ITEM_META } from '~/enums/metric-item'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { share } from '~/server/admin-metrics/months'
import type { TMetricSeries } from '~/server/admin-metrics/series'
import { MetricSourceBadge } from './metric-source-badge'

const monthHeader = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

const formatPercent = (value: number) => `${Math.round(value * 100)} %`

const exportHref = (key: string, range: TMonthRange) => `/api/admin/metriques/export?item=${key}&from=${range.from}&to=${range.to}`

const MetricCell = ({ total, boursiers }: { total: number | null; boursiers: number | null }) => {
  if (total === null) return <>—</>
  const boursiersShare = boursiers === null ? null : share(boursiers, total)
  return (
    <>
      {total.toLocaleString('fr-FR')}
      {boursiers !== null && (
        <span className="fr-text--xs fr-text-mention--grey">
          {' '}
          ({boursiersShare === null ? '—' : formatPercent(boursiersShare)} boursiers)
        </span>
      )}
    </>
  )
}

export const MonthlyMetricsTable = ({ series, range }: { series: TMetricSeries[]; range: TMonthRange }) => {
  const months = series[0]?.values.map((value) => value.month) ?? []

  return (
    <div className="fr-table fr-table--no-caption">
      <div className="fr-table__wrapper">
        <div className="fr-table__container">
          <div className="fr-table__content">
            <table>
              <caption>Évolution mensuelle</caption>
              <thead>
                <tr>
                  <th scope="col">Indicateur</th>
                  {months.map((month) => (
                    <th key={month} scope="col">
                      {monthHeader(month)}
                    </th>
                  ))}
                  <th scope="col">Export</th>
                </tr>
              </thead>
              <tbody>
                {series.map((row) => {
                  const meta = METRIC_ITEM_META[row.key]
                  return (
                    <tr key={row.key}>
                      <th scope="row">
                        <div>{meta.label}</div>
                        <MetricSourceBadge source={meta.source} />
                        {meta.help && <Tooltip kind="click" title={meta.help} />}
                      </th>
                      {row.values.map((value) => (
                        <td key={value.month}>
                          <MetricCell total={value.total} boursiers={value.boursiers} />
                        </td>
                      ))}
                      <td>
                        <Button
                          priority="tertiary no outline"
                          iconId="fr-icon-download-line"
                          title={`Exporter ${meta.label} en CSV`}
                          linkProps={{ href: exportHref(row.key, range), download: true }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
