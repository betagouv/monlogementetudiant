'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { trackEvent } from '~/lib/tracking'
import styles from './owner-details.module.css'

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
        priority="primary"
        size="large"
        className={styles.sidebarOwnerButton}
      >
        {t('sidebar.buttons.consult')}
      </Button>
      <span> {t('sidebar.buttons.consultDescription')}</span>
    </>
  )
}
