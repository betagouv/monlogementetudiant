'use client'

import Pagination from '@codegouvfr/react-dsfr/Pagination'
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'
import clsx from 'clsx'
import { useState } from 'react'
import styles from './admin-data-table.module.css'

interface AdminDataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  pageCount: number
  page: number
  onPageChange?: (page: number) => void
  isLoading?: boolean
  isError?: boolean
  hidePagination?: boolean
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
}

export function AdminDataTable<T>({
  columns,
  data,
  pageCount,
  page,
  onPageChange,
  isLoading,
  isError,
  hidePagination = false,
  onRowClick,
  isRowSelected,
}: AdminDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualPagination: true,
    pageCount,
  })

  return (
    <div className={clsx('fr-table', styles.wrapper)}>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    className={canSort ? styles.sortableHeader : undefined}
                    style={{ width: header.getSize(), maxWidth: header.column.columnDef.maxSize }}
                  >
                    <div className="fr-flex fr-align-items-center fr-flex-gap-1v">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span
                          aria-hidden="true"
                          className={clsx(
                            styles.sortIcon,
                            header.column.getIsSorted() ? styles.sortIndicator : styles.sortIndicatorInactive,
                            header.column.getIsSorted() === 'asc'
                              ? 'fr-icon-arrow-up-line'
                              : header.column.getIsSorted() === 'desc'
                                ? 'fr-icon-arrow-down-line'
                                : 'fr-icon-arrow-up-down-line',
                          )}
                        />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className={styles.centerCell}>
                Chargement...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={columns.length} className={styles.errorCell}>
                Erreur lors du chargement des donnees
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.centerCell}>
                Aucun resultat
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={clsx(onRowClick && styles.clickableRow, isRowSelected?.(row.original) && styles.selectedRow)}
              >
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

      {!hidePagination && pageCount > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={pageCount}
          defaultPage={page}
          getPageLinkProps={(pageNumber) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              if (onPageChange) {
                onPageChange(pageNumber)
              }
            },
          })}
        />
      )}
    </div>
  )
}
