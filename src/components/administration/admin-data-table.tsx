'use client'

import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'
import { useState } from 'react'

interface AdminDataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  pageCount: number
  page: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  isError?: boolean
  enableSorting?: boolean
}

export function AdminDataTable<T>({
  columns,
  data,
  pageCount,
  page,
  onPageChange,
  isLoading,
  isError,
  enableSorting = false,
}: AdminDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting
      ? {
          getSortedRowModel: getSortedRowModel(),
          onSortingChange: setSorting,
          state: { sorting },
        }
      : {}),
    manualPagination: true,
    pageCount,
  })

  return (
    <div className="fr-table" style={{ overflow: 'auto', width: '100%' }}>
      <table style={{ width: '100%' }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = enableSorting && header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    style={canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                  >
                    <div className="fr-flex fr-align-items-center fr-flex-gap-1v">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span aria-hidden="true" style={{ fontSize: '0.75rem', opacity: header.column.getIsSorted() ? 1 : 0.3 }}>
                          {{ asc: ' \u2191', desc: ' \u2193' }[header.column.getIsSorted() as string] ?? ' \u2195'}
                        </span>
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
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                Chargement...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-default-error)' }}>
                Erreur lors du chargement des donnees
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                Aucun resultat
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} style={{ transition: 'background 0.1s ease' }}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pageCount > 1 && (
        <nav role="navigation" className="fr-pagination" aria-label="Pagination">
          <ul className="fr-pagination__list">
            <li>
              <button className="fr-pagination__link fr-pagination__link--first" disabled={page <= 1} onClick={() => onPageChange(1)}>
                Premiere page
              </button>
            </li>
            <li>
              <button className="fr-pagination__link fr-pagination__link--prev" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Page precedente
              </button>
            </li>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pageCount - 4))
              const pageNum = start + i
              return (
                <li key={pageNum}>
                  <button
                    className="fr-pagination__link"
                    aria-current={pageNum === page ? 'page' : undefined}
                    onClick={() => onPageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                </li>
              )
            })}
            <li>
              <button
                className="fr-pagination__link fr-pagination__link--next"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                Page suivante
              </button>
            </li>
            <li>
              <button
                className="fr-pagination__link fr-pagination__link--last"
                disabled={page >= pageCount}
                onClick={() => onPageChange(pageCount)}
              >
                Derniere page
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}
