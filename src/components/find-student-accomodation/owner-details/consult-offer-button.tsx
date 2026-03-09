'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'

interface ConsultOfferButtonProps {
  href: string
  slug: string
}

export const ConsultOfferButton = ({ href, slug }: ConsultOfferButtonProps) => {
  const t = useTranslations('accomodation')

  return (
    <>
      <Button
        linkProps={{
          href,
          onClick: () => trackEvent({ category: 'Logement', action: 'consulter offre', name: slug }),
        }}
        priority="tertiary"
        size="medium"
      >
        {t('sidebar.buttons.consult')}
      </Button>
      <span className="fr-text--xs fr-mb-0"> {t('sidebar.buttons.consultDescription')}</span>
    </>
  )
}
