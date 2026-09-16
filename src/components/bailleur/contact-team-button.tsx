'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'

export const ContactTeamButton = () => {
  const t = useTranslations('bailleur.helpCenter')
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
      {t('contactTeam')}
    </Button>
  )
}
