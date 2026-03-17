'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { trackEvent } from '~/lib/tracking'

export const ContactTeamButton = () => {
  return (
    <Button
      iconId="ri-search-line"
      priority="secondary"
      linkProps={{
        href: 'mailto:gestionnaire@monlogementetudiant.beta.gouv.fr',
        onClick: () => {
          trackEvent({ category: 'Espace Gestionnaire', action: 'contacter equipe' })
        },
      }}
    >
      Contacter l'équipe
    </Button>
  )
}
