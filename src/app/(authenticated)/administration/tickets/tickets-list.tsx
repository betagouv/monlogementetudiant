'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useState } from 'react'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { createToast } from '~/components/ui/createToast'
import {
  type ESupportTicketCategory,
  ESupportTicketStatus,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUSES,
  ZSupportTicketStatus,
} from '~/enums/support-ticket'
import { useTRPC } from '~/server/trpc/client'
import { formatDateTime } from '~/utils/formatDate'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

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

const statusBadgeSeverity: Record<ESupportTicketStatus, 'new' | 'info' | 'success'> = {
  [ESupportTicketStatus.OPEN]: 'new',
  [ESupportTicketStatus.IN_PROGRESS]: 'info',
  [ESupportTicketStatus.RESOLVED]: 'success',
}

const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  ...SUPPORT_TICKET_STATUSES.map((status) => ({ value: status, label: SUPPORT_TICKET_STATUS_LABELS[status] })),
]

const ticketModal = createModal({ id: 'support-ticket-detail-modal', isOpenedByDefault: false })

const truncate = (value: string) => (value.length > MESSAGE_PREVIEW_LENGTH ? `${value.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : value)

export function TicketsList() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)
  const [{ status, page }, setQueryStates] = useQueryStates({
    status: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })

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
      cell: ({ row }) => (
        <Badge severity={statusBadgeSeverity[row.original.status]} noIcon small>
          {SUPPORT_TICKET_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ]

  const total = data?.total ?? 0
  const counts = data?.statusCounts

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
          {total} ticket{sPluriel(total)} — signalements des étudiants connectés
        </p>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Ouverts</div>
          <div className={styles.statValue}>{counts?.[ESupportTicketStatus.OPEN] ?? 0}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>En cours</div>
          <div className={styles.statValue}>{counts?.[ESupportTicketStatus.IN_PROGRESS] ?? 0}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Résolus</div>
          <div className={styles.statValue}>{counts?.[ESupportTicketStatus.RESOLVED] ?? 0}</div>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-3">
          <Select
            label="Statut"
            nativeSelectProps={{
              value: status,
              onChange: (e) => setQueryStates({ status: e.target.value, page: 1 }),
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
        onPageChange={(p) => setQueryStates({ page: p })}
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
            <Select
              label="Statut"
              nativeSelectProps={{
                value: selectedTicket.status,
                onChange: (e) => updateStatus({ id: selectedTicket.id, status: e.target.value as ESupportTicketStatus }),
              }}
              options={SUPPORT_TICKET_STATUSES.map((s) => ({ value: s, label: SUPPORT_TICKET_STATUS_LABELS[s] }))}
            />
          </div>
        )}
      </ticketModal.Component>
    </>
  )
}
