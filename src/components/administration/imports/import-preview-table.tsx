'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { CsvPreviewResult, CsvPreviewRow } from '~/server/lib/import/csv-importer'

const columns: ColumnDef<CsvPreviewRow>[] = [
  {
    accessorKey: 'index',
    header: 'Ligne',
    cell: ({ row }) => <span className="fr-text-mention--grey fr-text--sm">{row.original.index}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Résidence',
    cell: ({ row }) => <span className="fr-text--bold">{row.original.name}</span>,
  },
  {
    accessorKey: 'city',
    header: 'Ville',
  },
  {
    accessorKey: 'owner',
    header: 'Gestionnaire',
  },
  {
    id: 'status',
    header: 'Statut',
    cell: ({ row }) =>
      row.original.status === 'valid' ? <Badge severity="success">Valide</Badge> : <Badge severity="error">Erreur</Badge>,
  },
  {
    accessorKey: 'message',
    header: 'Message',
    cell: ({ row }) => (row.original.message ? <span className="fr-text--sm fr-text-default-error">{row.original.message}</span> : null),
  },
]

type Props = {
  result: CsvPreviewResult
  onConfirm: () => void
  onCancel: () => void
}

export function ImportPreviewTable({ result, onConfirm, onCancel }: Props) {
  const table = useReactTable({ data: result.rows, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div>
      <div className="fr-flex fr-flex-gap-3v fr-mb-3w">
        <div className={clsx(styles.statCard, styles.statCardGreen, 'fr-p-2w')}>
          <div className={styles.statLabel}>Valides</div>
          <div className={styles.statValue}>{result.valid}</div>
        </div>
        <div className={clsx(styles.statCard, result.errors > 0 ? styles.statCardOrange : styles.statCardBlue, 'fr-p-2w')}>
          <div className={styles.statLabel}>Erreurs</div>
          <div className={styles.statValue}>{result.errors}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue, 'fr-p-2w')}>
          <div className={styles.statLabel}>Total</div>
          <div className={styles.statValue}>{result.total}</div>
        </div>
      </div>

      {result.errors > 0 && (
        <Alert
          severity="warning"
          small
          description={`${result.errors} ligne(s) contiennent des erreurs et seront ignorées lors de l'import.`}
          className="fr-mb-3w"
        />
      )}

      <div className={clsx('fr-table', styles.tableWrapper, 'fr-mb-3w')}>
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} scope="col">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fr-flex fr-flex-gap-2v">
        <Button onClick={onConfirm} disabled={result.valid === 0} iconId="fr-icon-upload-line">
          {`Importer ${result.valid} résidence(s)`}
        </Button>
        <Button priority="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
