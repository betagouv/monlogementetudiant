import { Badge } from '@codegouvfr/react-dsfr/Badge'
import clsx from 'clsx'

interface WaitingListBadgeProps {
  acceptWaitingList: boolean
  nbAvailable: number | null
  waitingListText: string
  className?: string
  as?: 'span' | 'p'
}

export function WaitingListBadge({ acceptWaitingList, nbAvailable, waitingListText, className, as }: WaitingListBadgeProps) {
  if (!acceptWaitingList || (nbAvailable !== null && nbAvailable !== undefined && nbAvailable > 0)) {
    return null
  }

  return (
    <Badge noIcon className={clsx('fr-badge--pink-macaron', className)} as={as}>
      <span className="fr-text--uppercase fr-mb-0">{waitingListText}</span>
    </Badge>
  )
}
