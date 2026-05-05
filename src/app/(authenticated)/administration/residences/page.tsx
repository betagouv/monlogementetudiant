'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Pagination from '@codegouvfr/react-dsfr/Pagination'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { useTRPC } from '~/server/trpc/client'
import styles from '../administration.module.css'

type ResidenceRow = {
  id: number
  name: string
  slug: string
  city: string
  citySlug: string | null
  published: boolean
  nbTotalApartments: number | null
  nbAvailableApartments: number
  ownerName: string
}

const columns: ColumnDef<ResidenceRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Residence',
    cell: ({ row }) => <span className="fr-text--bold">{row.original.name}</span>,
  },
  {
    accessorKey: 'ownerName',
    header: 'Gestionaire',
  },
  {
    accessorKey: 'city',
    header: 'Ville',
  },
  {
    accessorKey: 'nbTotalApartments',
    header: 'Logements',
    cell: ({ row }) => row.original.nbTotalApartments ?? '-',
  },
  {
    id: 'available',
    header: 'Dispo.',
    cell: ({ row }) => `${row.original.nbAvailableApartments} / ${row.original.nbTotalApartments ?? '-'}`,
  },
  {
    id: 'published',
    header: 'Statut',
    cell: ({ row }) => (row.original.published ? <Badge severity="success">Publiée</Badge> : <Badge severity="warning">Depubliée</Badge>),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="fr-flex fr-flex-gap-1v">
        <Button
          priority="tertiary"
          size="small"
          linkProps={{ href: `/trouver-un-logement-etudiant/ville/${row.original.citySlug}/${row.original.slug}`, target: '_blank' }}
        >
          Voir
        </Button>
        <Button priority="tertiary" size="small" linkProps={{ href: `/bailleur/residences/${row.original.slug}` }}>
          Modifier
        </Button>
      </div>
    ),
  },
]

export default function ResidencesPage() {
  const [{ search, page }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })
  const [debouncedSearch] = useDebounce(search, 300)
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.admin.residences.list.queryOptions({
      page,
      search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    }),
  )

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-home-4-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Résidences</h1>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-6">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Résidence, ville, gestionnaire...',
              value: search,
              onChange: (e) => setQueryStates({ search: e.target.value, page: 1 }),
            }}
          />
        </div>
        <div className="fr-col-md-6 fr-flex fr-justify-content-end">
          <Button iconId="fr-icon-download-line" priority="secondary" linkProps={{ href: '/api/admin/residences/export' }}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className={clsx('fr-table', styles.tableWrapper)}>
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} scope="col" style={{ width: header.getSize(), maxWidth: header.column.columnDef.maxSize }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className={clsx('fr-p-3w', styles.tableCenterCell)}>
                  Chargement...
                </td>
              </tr>
            ) : (data?.items ?? []).length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={clsx('fr-p-3w', styles.tableCenterCell)}>
                  Aucune residence
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize(), maxWidth: cell.column.columnDef.maxSize }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
              setQueryStates({ page: pageNumber })
            },
          })}
        />
      )}
    </>
  )
}
