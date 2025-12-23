import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { sPluriel } from '~/utils/sPluriel'

interface AvailabilityBadgeProps {
  nbAvailable: number | null
  noAvailabilityText: string
  availabilityText: string
  className?: string
  as?: 'span' | 'p'
}

export function AvailabilityBadge({ nbAvailable, noAvailabilityText, availabilityText, className, as }: AvailabilityBadgeProps) {
  if (nbAvailable === null || nbAvailable === undefined) {
    return null
  }

  if (nbAvailable === 0) {
    return (
      <Badge severity="error" noIcon className={className} as={as}>
        <span className="fr-text--uppercase fr-mb-0">{noAvailabilityText}</span>
      </Badge>
    )
  }

  return (
    <Badge severity="success" noIcon className={className} as={as}>
      {nbAvailable}&nbsp;
      <span className="fr-text--uppercase fr-mb-0">
        {availabilityText}
        {sPluriel(nbAvailable)}
      </span>
    </Badge>
  )
}
