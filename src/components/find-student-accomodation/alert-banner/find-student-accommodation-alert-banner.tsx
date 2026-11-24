'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Notification from '@codegouvfr/react-dsfr/picto/Notification'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { AlertsLoginRequiredButton } from '~/components/auth/login-required-button'
import { TTerritory } from '~/schemas/territories'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import { DAY_MS } from '~/utils/time'
import styles from './find-student-accommodation-alert-banner.module.css'

const STORAGE_KEY_PREFIX = 'mle:search-alert-banner-dismissed'
const DISMISS_DURATION_MS = 30 * DAY_MS

const isDismissed = (storageKey: string) => {
  const dismissedAt = Date.parse(localStorage.getItem(storageKey) ?? '')
  return !Number.isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS
}

type FindStudentAccommodationAlertBannerProps = {
  territory: TTerritory
  categoryKey?: string
  isAuthenticated: boolean
  compact?: boolean
  className?: string
}

export const FindStudentAccommodationAlertBanner = ({
  territory,
  categoryKey,
  isAuthenticated,
  compact,
  className,
}: FindStudentAccommodationAlertBannerProps) => {
  const t = useTranslations('findAccomodation.banner')
  const locale = useLocale()
  const [visible, setVisible] = useState(false)
  const storageKey = `${STORAGE_KEY_PREFIX}:${categoryKey ?? 'departement'}:${territory.slug}`

  useEffect(() => {
    try {
      setVisible(!isDismissed(storageKey))
    } catch {
      setVisible(true)
    }
  }, [storageKey])

  if (!visible) return null

  const title =
    categoryKey === 'ville'
      ? t('title.city', { locationFormatted: formatCityWithPreposition(locale, 'à', territory.name) })
      : categoryKey === 'academie'
        ? t('title.academy', { location: territory.name })
        : t('title.department', { location: territory.name })

  const onClose = () => {
    setVisible(false)
    try {
      localStorage.setItem(storageKey, new Date().toISOString())
    } catch (error) {
      console.warn('Fermeture du bandeau non mémorisée', error)
    }
  }

  return (
    <section className={clsx(styles.banner, compact && styles.compact, className)} aria-labelledby="search-alert-banner-title">
      <Notification className={styles.pictogram} width={80} height={80} aria-hidden="true" color="blue-ecume" />
      <div className={styles.content}>
        <h2 id="search-alert-banner-title" className="fr-h6 fr-mb-1v">
          {title}
        </h2>
        <p className="fr-mb-0">{t('description')}</p>
      </div>
      <div className={styles.action}>
        {isAuthenticated ? (
          <Button iconId="ri-notification-3-line" iconPosition="left" linkProps={{ href: '/mon-espace/alertes', target: '_self' }}>
            {t('cta')}
          </Button>
        ) : (
          <AlertsLoginRequiredButton iconId="ri-notification-3-line" iconPosition="left">
            {t('cta')}
          </AlertsLoginRequiredButton>
        )}
      </div>
      <Button className={styles.close} iconId="fr-icon-close-line" priority="tertiary" title={t('close')} onClick={onClose} />
    </section>
  )
}
