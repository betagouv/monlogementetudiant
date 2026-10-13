import clsx from 'clsx'

interface WaitingListBadgeProps {
  acceptWaitingList: boolean
  nbAvailable: number | null
  waitingListText: string
  className?: string
}

export function WaitingListBadge({ acceptWaitingList, nbAvailable, waitingListText, className }: WaitingListBadgeProps) {
  if (!acceptWaitingList || (nbAvailable !== null && nbAvailable !== undefined && nbAvailable > 0)) {
    return null
  }

  return <span className={clsx('ri-folder-2-line fr-flex fr-align-items-center fr-text--sm fr-mb-0', className)}>{waitingListText}</span>
}
