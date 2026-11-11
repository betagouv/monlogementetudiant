'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsString, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { CONTACT_PATH_TARGET } from '~/enums/contact-path-target'
import { useAdminMetricsContactPath, useAdminOwnersToTarget } from '~/hooks/use-admin-metrics'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import type { TOwnerToTarget } from '~/server/admin-metrics/contact-path'
import { defaultMonthRange } from '~/server/admin-metrics/months'
import styles from '../../../app/(authenticated)/administration/administration.module.css'
import statStyles from '../../../app/(authenticated)/administration/statistiques/statistiques.module.css'
import { MetricSourceBadge } from './metric-source-badge'
import { MonthRangeFilter } from './month-range-filter'

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

const formatPercent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)} %`)

const ownerColumns: ColumnDef<TOwnerToTarget, unknown>[] = [
  { accessorKey: 'ownerName', header: 'Gestionnaire', size: 260 },
  { accessorKey: 'residencesAvecDispo', header: 'Résidences avec places disponibles', size: 160 },
  { accessorKey: 'logementsDisponibles', header: 'Places disponibles', size: 130 },
]

const useContactPathRange = (): [TMonthRange, (range: Partial<TMonthRange>) => void] => {
  const defaults = useMemo(() => defaultMonthRange(), [])
  const [qs, setQs] = useQueryStates({
    moisDe: parseAsString.withDefault(defaults.from),
    moisA: parseAsString.withDefault(defaults.to),
  })
  return [
    { from: qs.moisDe, to: qs.moisA },
    (range) => setQs({ ...(range.from && { moisDe: range.from }), ...(range.to && { moisA: range.to }) }),
  ]
}

export const ContactPathTab = () => {
  const [range, setRange] = useContactPathRange()
  const series = useAdminMetricsContactPath(range)
  const owners = useAdminOwnersToTarget()

  const months = series.data ?? []
  const hasData = months.some((month) => month.logementsPublies !== null)
  const latest = [...months].reverse().find((month) => month.residencesSansTotal !== null)
  const chartData = months.map((month) => ({
    month: monthLabel(month.month),
    part: month.part,
    gestionnairesActives: month.gestionnairesActives,
    gestionnairesAvecDispo: month.gestionnairesAvecDispo,
  }))

  return (
    <>
      <MonthRangeFilter range={range} onChange={setRange} />

      <div className={clsx(styles.card, 'fr-my-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Part des logements avec parcours contact activé <MetricSourceBadge source="Relevé mensuel" />
          </span>
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: `/api/admin/metriques/export?item=parcours-contact&from=${range.from}&to=${range.to}`, download: true }}
          >
            Exporter en CSV
          </Button>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-px-2w fr-mb-1w">
          Part des logements publiés hors CROUS dont le parcours contact est activé par le gestionnaire (en logements)
        </p>
        {latest && latest.residencesSansTotal !== null && latest.residencesSansTotal > 0 && (
          <p className="fr-text--xs fr-text-mention--grey fr-px-2w fr-mb-1w">
            {latest.residencesSansTotal} résidences sans nombre de logements exclues
          </p>
        )}
        <div className={statStyles.chartContainer}>
          {series.isLoading ? (
            <div className={statStyles.noData}>Chargement...</div>
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} domain={[0, 'auto']} tickFormatter={(value: number) => formatPercent(value)} />
                <Tooltip formatter={(value) => formatPercent(typeof value === 'number' ? value : null)} />
                <ReferenceLine
                  y={CONTACT_PATH_TARGET}
                  stroke="#18753c"
                  strokeDasharray="4 4"
                  label={{ value: `Cible ${Math.round(CONTACT_PATH_TARGET * 100)} %`, position: 'insideTopRight', fontSize: 11 }}
                />
                <Line type="monotone" dataKey="part" name="Part des logements" stroke="#000091" strokeWidth={2} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={statStyles.noData}>Pas encore de relevé pour cette période.</div>
          )}
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Gestionnaires : parcours contact activé et places disponibles <MetricSourceBadge source="Relevé mensuel" />
          </span>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-px-2w fr-mb-1w">
          Activé par le gestionnaire : un mode de contact est choisi, que ses résidences soient suspendues ou fermées aux candidatures ou
          non. Places disponibles : seules les disponibilités renseignées et supérieures à 0 comptent.
        </p>
        <div className={statStyles.chartContainer}>
          {series.isLoading ? (
            <div className={statStyles.noData}>Chargement...</div>
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="gestionnairesActives" name="Parcours contact activé" stroke="#000091" strokeWidth={2} />
                <Line type="monotone" dataKey="gestionnairesAvecDispo" name="Avec places disponibles" stroke="#e8944a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={statStyles.noData}>Pas encore de relevé pour cette période.</div>
          )}
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Gestionnaires à cibler ({owners.data?.length ?? 0})</span>
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: '/api/admin/metriques/export?item=gestionnaires-a-cibler', download: true }}
          >
            Exporter en CSV
          </Button>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-px-2w fr-mb-1w">
          Gestionnaires ayant des places disponibles (renseignées et supérieures à 0) mais n&apos;ayant pas activé le parcours contact.
        </p>
        <div className="fr-px-2w">
          <AdminDataTable
            columns={ownerColumns}
            data={owners.data ?? []}
            pageCount={1}
            page={1}
            isLoading={owners.isLoading}
            isError={owners.isError}
            hidePagination
          />
        </div>
      </div>
    </>
  )
}
