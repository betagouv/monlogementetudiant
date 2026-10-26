import Badge from '@codegouvfr/react-dsfr/Badge'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import clsx from 'clsx'
import { ESupportTicketStatus, SUPPORT_TICKET_STATUS_LABELS, SUPPORT_TICKET_STATUSES } from '~/enums/support-ticket'
import styles from '../administration.module.css'

const statusBadgeSeverity: Record<ESupportTicketStatus, 'new' | 'info' | 'success'> = {
  [ESupportTicketStatus.OPEN]: 'new',
  [ESupportTicketStatus.IN_PROGRESS]: 'info',
  [ESupportTicketStatus.RESOLVED]: 'success',
}

export const statusFilterOptions = [
  { value: '', label: 'Tous les statuts' },
  ...SUPPORT_TICKET_STATUSES.map((status) => ({ value: status, label: SUPPORT_TICKET_STATUS_LABELS[status] })),
]

export const StatusBadge = ({ status }: { status: ESupportTicketStatus }) => (
  <Badge severity={statusBadgeSeverity[status]} noIcon small>
    {SUPPORT_TICKET_STATUS_LABELS[status]}
  </Badge>
)

export const StatusCounts = ({ counts }: { counts?: Record<ESupportTicketStatus, number> }) => (
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
)

export const StatusSelect = ({ value, onChange }: { value: ESupportTicketStatus; onChange: (status: ESupportTicketStatus) => void }) => (
  <Select
    label="Statut"
    nativeSelectProps={{ value, onChange: (e) => onChange(e.target.value as ESupportTicketStatus) }}
    options={SUPPORT_TICKET_STATUSES.map((s) => ({ value: s, label: SUPPORT_TICKET_STATUS_LABELS[s] }))}
  />
)
