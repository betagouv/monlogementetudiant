import { Badge } from '@codegouvfr/react-dsfr/Badge'

interface AvailabilityBadgeProps {
  nbAvailable: number | null
  noAvailabilityText: string
  /** Libellé accolé au nombre de logements disponibles ; reçoit ce nombre pour gérer l'accord (pluriel ICU). */
  availabilityText: (count: number) => string
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
    if (!unknownAvailabilityText) return null
    return (
      <Badge noIcon className={className} as={as}>
        <span className="fr-text--uppercase fr-mb-0">{unknownAvailabilityText}</span>
      </Badge>
    )
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
      <span className="fr-text--uppercase fr-mb-0">{availabilityText(nbAvailable)}</span>
    </Badge>
  )
}
