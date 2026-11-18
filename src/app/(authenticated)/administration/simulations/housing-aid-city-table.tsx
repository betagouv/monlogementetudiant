'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import Table from '@codegouvfr/react-dsfr/Table'
import Link from 'next/link'
import { type ReactNode, useMemo, useState } from 'react'
import { Pagination } from '~/components/ui/pagination'
import type { SimulationCityRow } from '~/server/admin/simulations-by-city'
import { normalizeText } from '~/utils/normalize-text'
import { amount, fmt, rate, SIMULATIONS_HREF } from './simulations-ui'

const PAGE_SIZE = 15

type SortColumn = 'city' | 'simulations' | 'students' | 'averageIncome' | 'averageRent' | 'guarantorRate'
type Sort = { column: SortColumn; direction: 'ascending' | 'descending' }

const COLUMNS: { column: SortColumn; label: string }[] = [
  { column: 'city', label: 'Ville' },
  { column: 'simulations', label: 'Simulations' },
  { column: 'students', label: 'Étudiants' },
  { column: 'averageIncome', label: 'Revenus moyens' },
  { column: 'averageRent', label: 'Loyer moyen envisagé' },
  { column: 'guarantorRate', label: 'Avec garant' },
]

export const cityDetailHref = (key: string) => `${SIMULATIONS_HREF}?ville=${encodeURIComponent(key)}`

function compare(a: SimulationCityRow, b: SimulationCityRow, { column, direction }: Sort) {
  const factor = direction === 'ascending' ? 1 : -1
  if (column === 'city') return a.city.localeCompare(b.city, 'fr') * factor
  const left = a[column]
  const right = b[column]
  // Valeurs absentes toujours en fin de tableau, quel que soit le sens.
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return (left - right) * factor || a.city.localeCompare(b.city, 'fr')
}

function downloadCsv(rows: SimulationCityRow[]) {
  const header = [
    'Ville',
    'Ville universitaire',
    'Simulations',
    'Étudiants',
    'Revenus moyens (€)',
    'Loyer moyen envisagé (€)',
    'Avec garant (%)',
  ]
  const lines = rows.map((row) =>
    [
      `"${row.city.replaceAll('"', '""')}"`,
      row.isUniversityCity ? 'oui' : 'non',
      row.simulations,
      row.students,
      row.averageIncome ?? '',
      row.averageRent ?? '',
      row.guarantorRate ?? '',
    ].join(';'),
  )
  // BOM UTF-8 pour qu'Excel détecte l'encodage
  const blob = new Blob(['﻿', [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `simulations-aides-par-ville-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function HousingAidCityTable({ rows, totalSimulations }: { rows: SimulationCityRow[]; totalSimulations: number }) {
  const [query, setQuery] = useState('')
  const [universityOnly, setUniversityOnly] = useState(false)
  const [sort, setSort] = useState<Sort>({ column: 'simulations', direction: 'descending' })
  const [page, setPage] = useState(1)

  const filteredRows = useMemo(() => {
    const needle = normalizeText(query.trim())
    return rows
      .filter((row) => (!universityOnly || row.isUniversityCity) && (!needle || normalizeText(row.city).includes(needle)))
      .sort((a, b) => compare(a, b, sort))
  }, [rows, query, universityOnly, sort])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const toggleSort = (column: SortColumn) => {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { column, direction: column === 'city' ? 'ascending' : 'descending' },
    )
    setPage(1)
  }

  const headers: ReactNode[] = COLUMNS.map(({ column, label }) => (
    <div key={column} className="fr-cell--sort">
      <span>{label}</span>
      <button
        type="button"
        className="fr-btn--sort fr-btn fr-btn--sm"
        aria-sort={sort.column === column ? sort.direction : undefined}
        title={`Trier par ${label.toLowerCase()}`}
        onClick={() => toggleSort(column)}
      >
        Trier par {label.toLowerCase()}
      </button>
    </div>
  ))

  return (
    <>
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom fr-mb-1w">
        <div className="fr-col-12 fr-col-md-5">
          <Input
            label="Rechercher une ville"
            className="fr-mb-0"
            nativeInputProps={{
              type: 'search',
              value: query,
              onChange: (event) => {
                setQuery(event.target.value)
                setPage(1)
              },
            }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-4">
          <Checkbox
            small
            className="fr-mb-0"
            options={[
              {
                label: 'Grandes villes universitaires uniquement',
                nativeInputProps: {
                  checked: universityOnly,
                  onChange: (event) => {
                    setUniversityOnly(event.target.checked)
                    setPage(1)
                  },
                },
              },
            ]}
          />
        </div>
        <div className="fr-col-12 fr-col-md-3 fr-flex fr-justify-content-md-end">
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-download-line"
            disabled={filteredRows.length === 0}
            onClick={() => downloadCsv(filteredRows)}
          >
            Exporter en CSV
          </Button>
        </div>
      </div>

      <p className="fr-text--sm fr-mb-0" aria-live="polite">
        {fmt(filteredRows.length)} ville{filteredRows.length > 1 ? 's' : ''}
      </p>

      {filteredRows.length === 0 ? (
        <p className="fr-text--sm fr-text-mention--grey fr-mt-2w">Aucune ville ne correspond à ces critères.</p>
      ) : (
        <Table
          noCaption
          caption="Simulations d'aides au logement par ville visée"
          headers={headers}
          data={pagedRows.map((row) => [
            <span key="city" className="fr-flex fr-flex-wrap fr-align-items-center fr-flex-gap-2v">
              <Link href={cityDetailHref(row.key)} className="fr-link">
                {row.city}
              </Link>
              {row.isUniversityCity && (
                <Badge small severity="info" noIcon>
                  Ville universitaire
                </Badge>
              )}
            </span>,
            `${fmt(row.simulations)} (${totalSimulations ? Math.round((row.simulations / totalSimulations) * 100) : 0} %)`,
            fmt(row.students),
            amount(row.averageIncome),
            amount(row.averageRent),
            rate(row.guarantorRate),
          ])}
        />
      )}

      {pageCount > 1 && (
        <div className="fr-flex fr-justify-content-center">
          <Pagination
            count={pageCount}
            defaultPage={currentPage}
            getPageLinkProps={(p) => ({
              href: '#',
              onClick: (event: React.MouseEvent) => {
                event.preventDefault()
                setPage(p)
              },
            })}
          />
        </div>
      )}
    </>
  )
}
