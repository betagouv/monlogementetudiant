'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'
import { useTRPCClient } from '~/server/trpc/client'

interface ConsultOfferButtonProps {
  href: string
  slug: string
  priority?: 'primary' | 'tertiary'
}

export const ConsultOfferButton = ({ href, slug, priority = 'tertiary' }: ConsultOfferButtonProps) => {
  const t = useTranslations('accomodation')
  const trpcClient = useTRPCClient()

  const handleClick = () => {
    trackEvent({ category: 'Logement', action: 'consulter offre', name: slug })
    if (slug) {
      trpcClient.tracking.logConsultOffer.mutate({ accommodationSlug: slug }).catch(() => undefined)
    }
  }

  return (
    <>
      <Button
        linkProps={{
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          onClick: handleClick,
        }}
        priority={priority}
        size="medium"
      >
        {t('sidebar.buttons.consult')}
      </Button>
      <span className="fr-text--xs fr-mb-0"> {t('sidebar.buttons.consultDescription')}</span>
    </>
  )
}
