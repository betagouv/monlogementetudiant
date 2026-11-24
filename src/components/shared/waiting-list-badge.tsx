import { Badge } from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'

interface WaitingListBadgeProps {
  acceptWaitingList: boolean
  nbAvailable: number | null
  waitingListText: string
  className?: string
  as?: 'span' | 'p'
}

export const shouldShowWaitingListBadge = (acceptWaitingList: boolean, nbAvailable: number | null | undefined) =>
  acceptWaitingList && (nbAvailable === null || nbAvailable === undefined || nbAvailable <= 0)

export function WaitingListBadge({ acceptWaitingList, nbAvailable, waitingListText, className, as }: WaitingListBadgeProps) {
  if (!shouldShowWaitingListBadge(acceptWaitingList, nbAvailable)) return null

  return (
    <Badge noIcon className={clsx('fr-badge--purple-glycine', className)} as={as}>
      <span className="fr-text--uppercase fr-mb-0">{waitingListText}</span>
    </Badge>
  )
}
