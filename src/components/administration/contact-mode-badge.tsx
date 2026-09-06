import Badge from '@codegouvfr/react-dsfr/Badge'
import { EOwnerContactMode, OWNER_CONTACT_MODE_LABELS } from '~/enums/owner-contact-mode'

/**
 * Mode de réception des candidatures d'un gestionnaire, affiché de façon homogène dans
 * l'espace administration (liste et fiche gestionnaire). `null` est traité comme `none`.
 */
const CONTACT_MODE_SEVERITY: Record<EOwnerContactMode, 'success' | 'info' | undefined> = {
  [EOwnerContactMode.DOSSIER_FACILE]: 'success',
  [EOwnerContactMode.CONTACTS]: 'info',
  [EOwnerContactMode.NONE]: undefined,
}

export function ContactModeBadge({ mode, small = false }: { mode: EOwnerContactMode | null; small?: boolean }) {
  const value = mode ?? EOwnerContactMode.NONE

  return (
    <Badge as="span" noIcon small={small} severity={CONTACT_MODE_SEVERITY[value]}>
      {OWNER_CONTACT_MODE_LABELS[value]}
    </Badge>
  )
}
