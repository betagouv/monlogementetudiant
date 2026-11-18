'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { MetricSourceBadge } from '~/components/administration/metrics/metric-source-badge'
import { MonthFilter, useMonth } from '~/components/administration/metrics/month-filter'
import { useAdminCityMetrics } from '~/hooks/use-admin-metrics'
import type { TCityMonthRow } from '~/server/admin-metrics/territories'
import styles from '../administration.module.css'

const formatPercent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)} %`)

const formatCount = (value: number | null) => (value === null ? '—' : value.toLocaleString('fr-FR'))

const tensionColumns: ColumnDef<TCityMonthRow, unknown>[] = [
  { accessorKey: 'cityName', header: 'Ville', size: 200 },
  { accessorKey: 'recherches', header: 'Recherches', size: 110 },
  {
    accessorKey: 'disponibles',
    header: 'Logements disponibles',
    cell: ({ getValue }) => formatCount(getValue() as number | null),
    size: 150,
  },
  {
    accessorKey: 'totalRenseigne',
    header: 'Total des logements renseignés',
    cell: ({ getValue }) => formatCount(getValue() as number | null),
    size: 170,
  },
  { accessorKey: 'tension', header: 'Tension du marché', cell: ({ getValue }) => formatPercent(getValue() as number | null), size: 140 },
  {
    accessorKey: 'couverture',
    header: 'Taux de couverture',
    cell: ({ getValue }) => formatPercent(getValue() as number | null),
    size: 140,
  },
]

const relaxedColumns: ColumnDef<TCityMonthRow, unknown>[] = [
  { accessorKey: 'cityName', header: 'Ville', size: 200 },
  { accessorKey: 'recherches', header: 'Recherches', size: 110 },
  { accessorKey: 'tension', header: 'Tension', cell: ({ getValue }) => formatPercent(getValue() as number | null), size: 110 },
  {
    accessorKey: 'residencesOuvertes',
    header: 'Résidences ouvertes',
    cell: ({ getValue }) => formatCount(getValue() as number | null),
    size: 150,
  },
  {
    accessorKey: 'residencesOuvertesSansContact',
    header: 'Ouvertes sans contact',
    cell: ({ getValue }) => formatCount(getValue() as number | null),
    size: 150,
  },
  {
    accessorKey: 'partSansContact',
    header: 'Part sans contact',
    cell: ({ getValue }) => formatPercent(getValue() as number | null),
    size: 130,
  },
]

const exportHref = (item: string, month: string) => `/api/admin/metriques/export?item=${item}&month=${month}`

export default function TerritoiresPage() {
  const [month, setMonth] = useMonth()
  const { data, isLoading, isError } = useAdminCityMetrics(month)
  const rows = data ?? []
  const tensionRows = rows.filter((row) => !(row.recherches === 0 && !row.totalPublie))
  const relaxedRows = rows
    .filter((row) => (row.residencesOuvertes ?? 0) > 0)
    .sort((a, b) => (b.partSansContact ?? -1) - (a.partSansContact ?? -1) || b.recherches - a.recherches)

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-map-pin-2-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Territoires</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Tension du marché et parcours contact par ville, mois par mois</p>
      </div>

      <MonthFilter month={month} onChange={setMonth} />
      <p className="fr-text--sm fr-text-mention--grey fr-mb-0">Données mises à jour chaque nuit</p>

      <div className={clsx(styles.card, 'fr-my-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Tension du marché <MetricSourceBadge source="Relevé mensuel" />
          </span>
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: exportHref('tension-marche', month), download: true }}
          >
            Exporter en CSV
          </Button>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-px-2w fr-mb-1w">
          Tension du marché : logements disponibles / total des logements, calculé uniquement sur les résidences publiées qui renseignent
          leurs disponibilités. Le taux de couverture est la part des logements publiés dont la disponibilité est renseignée.
        </p>
        <div className="fr-px-2w">
          <AdminDataTable
            columns={tensionColumns}
            data={tensionRows}
            pageCount={1}
            page={1}
            isLoading={isLoading}
            isError={isError}
            hidePagination
          />
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            Zones détendues sans contact <MetricSourceBadge source="Relevé mensuel" />
          </span>
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: exportHref('zones-detendues', month), download: true }}
          >
            Exporter en CSV
          </Button>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-px-2w fr-mb-1w">
          Résidences dont le parcours contact est ouvert : activé par le gestionnaire, et la résidence accepte les candidatures sans être
          suspendue.
        </p>
        <div className="fr-px-2w">
          <AdminDataTable
            columns={relaxedColumns}
            data={relaxedRows}
            pageCount={1}
            page={1}
            isLoading={isLoading}
            isError={isError}
            hidePagination
          />
        </div>
      </div>
    </>
  )
}
