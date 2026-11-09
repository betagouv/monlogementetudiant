'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'
import { useTRPCClient } from '~/server/trpc/client'

interface ConsultOfferButtonProps {
  href: string
  slug: string
  isCrous?: boolean
  priority?: 'primary' | 'tertiary'
}

export const ConsultOfferButton = ({ href, slug, isCrous = false, priority = 'tertiary' }: ConsultOfferButtonProps) => {
  const t = useTranslations('accomodation')
  const tA11y = useTranslations('accessibility')
  const trpcClient = useTRPCClient()
  const hintKey = isCrous ? 'sidebar.buttons.consultDescriptionCrous' : 'sidebar.buttons.consultDescription'

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
          title: tA11y('linkNewWindow', { label: t('sidebar.buttons.consult') }),
        }}
        priority={priority}
        size="medium"
      >
        {t('sidebar.buttons.consult')}
      </Button>
      <span className="fr-text--xs fr-mb-0"> {t(hintKey)}</span>
    </>
  )
}
