'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useState } from 'react'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { createToast } from '~/components/ui/createToast'
import {
  type ESupportTicketCategory,
  type ESupportTicketStatus,
  SUPPORT_TICKET_CATEGORY_LABELS,
  ZSupportTicketStatus,
} from '~/enums/support-ticket'
import { useTRPC } from '~/server/trpc/client'
import { formatDateTime } from '~/utils/formatDate'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'
import { AccommodationReportsList } from './accommodation-reports-list'
import { StatusBadge, StatusCounts, StatusSelect, statusFilterOptions } from './ticket-status'

type TicketRow = {
  id: string
  category: ESupportTicketCategory
  message: string
  status: ESupportTicketStatus
  createdAt: Date
  userName: string
  userEmail: string
}

const MESSAGE_PREVIEW_LENGTH = 80

const ticketModal = createModal({ id: 'support-ticket-detail-modal', isOpenedByDefault: false })

const truncate = (value: string) => (value.length > MESSAGE_PREVIEW_LENGTH ? `${value.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : value)

const TAB_TICKETS = 'tickets'
const TAB_REPORTS = 'signalements'

export function TicketsList() {
  const [{ onglet, status, page }, setQueryStates] = useQueryStates({
    onglet: parseAsString.withDefault(TAB_TICKETS),
    status: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })
  const selectedTabId = onglet === TAB_REPORTS ? TAB_REPORTS : TAB_TICKETS

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-mail-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Tickets de support</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          Signalements des étudiants connectés et erreurs signalées sur les fiches résidences
        </p>
      </div>

      <Tabs
        selectedTabId={selectedTabId}
        onTabChange={(tabId) => setQueryStates({ onglet: tabId, status: '', page: 1 })}
        tabs={[
          { tabId: TAB_TICKETS, label: 'Tickets étudiants', iconId: 'fr-icon-user-line' },
          { tabId: TAB_REPORTS, label: 'Signalements de résidences', iconId: 'fr-icon-home-4-line' },
        ]}
      >
        {selectedTabId === TAB_REPORTS ? (
          <AccommodationReportsList status={status} page={page} onFiltersChange={setQueryStates} />
        ) : (
          <SupportTicketsList status={status} page={page} onFiltersChange={setQueryStates} />
        )}
      </Tabs>
    </>
  )
}

type SupportTicketsListProps = {
  status: string
  page: number
  onFiltersChange: (filters: { status?: string; page?: number }) => void
}

function SupportTicketsList({ status, page, onFiltersChange }: SupportTicketsListProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)

  const parsedStatus = ZSupportTicketStatus.safeParse(status)
  const filters = { page, status: parsedStatus.success ? parsedStatus.data : undefined }
  const { data, isLoading } = useQuery(trpc.supportTickets.admin.list.queryOptions(filters))

  const { mutate: updateStatus } = useMutation(
    trpc.supportTickets.admin.updateStatus.mutationOptions({
      onSuccess: async (updated) => {
        setSelectedTicket((current) => (current ? { ...current, status: updated.status as ESupportTicketStatus } : current))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.supportTickets.admin.list.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.supportTickets.admin.count.queryKey() }),
        ])
      },
      onError: (error) => {
        createToast({ priority: 'error', message: error.message || 'Le statut n’a pas pu être mis à jour' })
      },
    }),
  )

  const openTicket = (ticket: TicketRow) => {
    setSelectedTicket(ticket)
    ticketModal.open()
  }

  const columns: ColumnDef<TicketRow, unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      enableSorting: false,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'userEmail',
      header: 'Étudiant',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className="fr-text--bold">{row.original.userName}</div>
          <div className="fr-text--xs fr-text-mention--grey">{row.original.userEmail}</div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Catégorie',
      enableSorting: false,
      cell: ({ row }) => SUPPORT_TICKET_CATEGORY_LABELS[row.original.category],
    },
    {
      accessorKey: 'message',
      header: 'Message',
      enableSorting: false,
      cell: ({ row }) => truncate(row.original.message),
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  const total = data?.total ?? 0

  return (
    <>
      <p className="fr-text--sm fr-text-mention--grey">
        {total} ticket{sPluriel(total)}
      </p>

      <StatusCounts counts={data?.statusCounts} />

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-3">
          <Select
            label="Statut"
            nativeSelectProps={{
              value: status,
              onChange: (e) => onFiltersChange({ status: e.target.value, page: 1 }),
            }}
            options={statusFilterOptions}
          />
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={(data?.items ?? []) as TicketRow[]}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={(p) => onFiltersChange({ page: p })}
        onRowClick={openTicket}
        isLoading={isLoading}
      />

      <ticketModal.Component title="Détail du ticket" buttons={[{ children: 'Fermer', priority: 'secondary' }]}>
        {selectedTicket && (
          <div className="fr-flex fr-direction-column fr-flex-gap-3v">
            <div>
              <span className="fr-text--bold">{selectedTicket.userName}</span>{' '}
              <span className="fr-text--xs fr-text-mention--grey">{selectedTicket.userEmail}</span>
            </div>
            <div className="fr-text--sm fr-text-mention--grey">
              {SUPPORT_TICKET_CATEGORY_LABELS[selectedTicket.category]} · {formatDateTime(selectedTicket.createdAt)}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }} className="fr-mb-0">
              {selectedTicket.message}
            </p>
            <StatusSelect value={selectedTicket.status} onChange={(s) => updateStatus({ id: selectedTicket.id, status: s })} />
          </div>
        )}
      </ticketModal.Component>
    </>
  )
}
