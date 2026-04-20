import { Badge } from '@codegouvfr/react-dsfr/Badge'
import { sPluriel } from '~/utils/sPluriel'

interface AvailabilityBadgeProps {
  nbAvailable: number | null
  noAvailabilityText: string
  availabilityText: string
  unknownAvailabilityText?: string
  className?: string
  as?: 'span' | 'p'
  context?: 'owner' | 'public'
}

export function AvailabilityBadge({
  nbAvailable,
  noAvailabilityText,
  availabilityText,
  unknownAvailabilityText,
  className,
  as,
  context = 'public',
}: AvailabilityBadgeProps) {
  if (nbAvailable === null || nbAvailable === undefined) {
    if (context === 'owner') {
      return (
        <Badge severity="warning" noIcon className={className} as={as}>
          <span className="fr-text--uppercase fr-mb-0">{unknownAvailabilityText}</span>
        </Badge>
      )
    }
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
