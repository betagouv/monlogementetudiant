import { Badge } from '@codegouvfr/react-dsfr/Badge'

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
    <Badge className={className} severity="warning" noIcon as={as}>
      <span className="fr-text--uppercase fr-mb-0">{waitingListText}</span>
    </Badge>
  )
}
