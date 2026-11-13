'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'
import { useTRPCClient } from '~/server/trpc/client'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import styles from './consult-offer-button.module.css'

interface ConsultOfferButtonProps {
  href: string
  slug: string
  isCrous?: boolean
  priority?: 'primary' | 'secondary' | 'tertiary'
  managerName?: string
}

export const ConsultOfferButton = ({ href, slug, isCrous = false, priority = 'tertiary', managerName }: ConsultOfferButtonProps) => {
  const t = useTranslations('accomodation')
  const tA11y = useTranslations('accessibility')
  const locale = useLocale()
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
          title: tA11y('linkNewWindow', { label: t('sidebar.buttons.consult') }),
        }}
        priority={priority}
        size="medium"
      >
        {t('sidebar.buttons.consult')}
      </Button>
      <span className={clsx('fr-text--xs fr-mt-1w fr-mb-0', styles.description)}>
        {isCrous
          ? t('sidebar.buttons.consultDescriptionCrous')
          : managerName
            ? t('sidebar.buttons.consultDescriptionManager', { managerFormatted: formatCityWithPreposition(locale, 'de', managerName) })
            : t('sidebar.buttons.consultDescription')}
      </span>
    </>
  )
}
