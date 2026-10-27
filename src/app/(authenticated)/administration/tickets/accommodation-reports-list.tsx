'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useState } from 'react'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { createToast } from '~/components/ui/createToast'
import { NewWindowHint } from '~/components/ui/new-window'
import { ACCOMMODATION_REPORT_FIELD_LABELS, ZAccommodationReportField } from '~/enums/accommodation-report-field'
import { type ESupportTicketStatus, ZSupportTicketStatus } from '~/enums/support-ticket'
import { useTRPC } from '~/server/trpc/client'
import { formatDateTime } from '~/utils/formatDate'
import { StatusBadge, StatusCounts, StatusSelect, statusFilterOptions } from './ticket-status'

type ReportRow = {
  id: string
  field: string
  details: string | null
  status: ESupportTicketStatus
  createdAt: Date
  accommodationName: string
  accommodationSlug: string
  citySlug: string | null
  ownerName: string | null
}

const DETAILS_PREVIEW_LENGTH = 80

const reportModal = createModal({ id: 'accommodation-report-detail-modal', isOpenedByDefault: false })

const fieldLabel = (field: string) => {
  const parsed = ZAccommodationReportField.safeParse(field)
  return parsed.success ? ACCOMMODATION_REPORT_FIELD_LABELS[parsed.data] : field
}

const truncate = (value: string) => (value.length > DETAILS_PREVIEW_LENGTH ? `${value.slice(0, DETAILS_PREVIEW_LENGTH)}…` : value)

const accommodationHref = (report: ReportRow) =>
  report.citySlug ? `/trouver-un-logement-etudiant/ville/${report.citySlug}/${report.accommodationSlug}` : null

type AccommodationReportsListProps = {
  status: string
  page: number
  onFiltersChange: (filters: { status?: string; page?: number }) => void
}

export function AccommodationReportsList({ status, page, onFiltersChange }: AccommodationReportsListProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null)

  const parsedStatus = ZSupportTicketStatus.safeParse(status)
  const filters = { page, status: parsedStatus.success ? parsedStatus.data : undefined }
  const { data, isLoading } = useQuery(trpc.supportTickets.admin.reports.list.queryOptions(filters))

  const { mutate: updateStatus } = useMutation(
    trpc.supportTickets.admin.reports.updateStatus.mutationOptions({
      onSuccess: async (updated) => {
        setSelectedReport((current) => (current ? { ...current, status: updated.status as ESupportTicketStatus } : current))
        await queryClient.invalidateQueries({ queryKey: trpc.supportTickets.admin.reports.list.queryKey() })
      },
      onError: (error) => {
        createToast({ priority: 'error', message: error.message || 'Le statut n’a pas pu être mis à jour' })
      },
    }),
  )

  const openReport = (report: ReportRow) => {
    setSelectedReport(report)
    reportModal.open()
  }

  const columns: ColumnDef<ReportRow, unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      enableSorting: false,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'accommodationName',
      header: 'Résidence',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className="fr-text--bold">{row.original.accommodationName}</div>
          <div className="fr-text--xs fr-text-mention--grey">{row.original.ownerName ?? 'Gestionnaire non renseigné'}</div>
        </div>
      ),
    },
    {
      accessorKey: 'field',
      header: 'Information concernée',
      enableSorting: false,
      cell: ({ row }) => fieldLabel(row.original.field),
    },
    {
      accessorKey: 'details',
      header: 'Précisions',
      enableSorting: false,
      cell: ({ row }) => (row.original.details ? truncate(row.original.details) : '—'),
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  const selectedHref = selectedReport ? accommodationHref(selectedReport) : null

  return (
    <>
      <StatusCounts counts={data?.statusCounts} />

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-3">
          <Select
            label="Statut"
            nativeSelectProps={{ value: status, onChange: (e) => onFiltersChange({ status: e.target.value, page: 1 }) }}
            options={statusFilterOptions}
          />
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={(data?.items ?? []) as ReportRow[]}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={(p) => onFiltersChange({ page: p })}
        onRowClick={openReport}
        isLoading={isLoading}
      />

      <reportModal.Component title="Détail du signalement" buttons={[{ children: 'Fermer', priority: 'secondary' }]}>
        {selectedReport && (
          <div className="fr-flex fr-direction-column fr-flex-gap-3v">
            <div>
              {selectedHref ? (
                <Link href={selectedHref} target="_blank" rel="noopener" className="fr-link fr-text--bold">
                  {selectedReport.accommodationName}
                  <NewWindowHint />
                </Link>
              ) : (
                <span className="fr-text--bold">{selectedReport.accommodationName}</span>
              )}{' '}
              <span className="fr-text--xs fr-text-mention--grey">{selectedReport.ownerName ?? 'Gestionnaire non renseigné'}</span>
            </div>
            <div className="fr-text--sm fr-text-mention--grey">
              {fieldLabel(selectedReport.field)} · {formatDateTime(selectedReport.createdAt)}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }} className="fr-mb-0">
              {selectedReport.details || 'Aucune précision renseignée'}
            </p>
            <StatusSelect value={selectedReport.status} onChange={(s) => updateStatus({ id: selectedReport.id, status: s })} />
          </div>
        )}
      </reportModal.Component>
    </>
  )
}
