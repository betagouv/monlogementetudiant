'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useStopImpersonation } from '~/hooks/use-impersonation'
import styles from './impersonation-banner.module.css'

type Props = {
  name: string
  email: string
}

export const ImpersonationBannerClient = ({ name, email }: Props) => {
  const t = useTranslations('impersonation')
  const { stopImpersonation, isPending } = useStopImpersonation()

  return (
    <div className="fr-py-1w fr-background-contrast--warning fr-border-bottom" role="status">
      <div className="fr-container fr-flex fr-flex-wrap fr-align-items-center fr-justify-content-space-between fr-flex-gap-2v">
        <p className={clsx('fr-text--sm fr-mb-0 fr-flex fr-align-items-center fr-flex-gap-2v ri-shield-user-line', styles.icon)}>
          <span>
            <strong>{t('title')}</strong> — {t('browsingAs')} <strong>{name}</strong> ({email})
          </span>
        </p>
        <Button size="small" priority="secondary" iconId="ri-arrow-go-back-line" onClick={() => stopImpersonation()} disabled={isPending}>
          {isPending ? t('stopping') : t('stop')}
        </Button>
      </div>
    </div>
  )
}
