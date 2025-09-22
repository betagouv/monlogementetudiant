'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import styles from './banner.module.css'

export const Banner = () => {
  const tallyUrl = z.string().parse(process.env.NEXT_PUBLIC_TALLY_URL)

  const t = useTranslations('header.banner')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const showBanner = sessionStorage.getItem('show-banner')
      setIsVisible(showBanner === null)
    }
  }, [])

  const handleClose = () => {
    sessionStorage.setItem('show-banner', 'false')
    setIsVisible(false)
  }

  if (!isVisible) return null
  return (
    <div className={clsx(styles.bannerContainer, fr.cx('fr-py-1w'))}>
      <div className={clsx(fr.cx('fr-container'), styles.bannerContent)}>
        <p className={styles.bannerText}>
          <span className={fr.cx('fr-text--bold', 'ri-sparkling-line')}>{t('title')}</span>
          &nbsp;
          <span>
            {t.rich('description', {
              link: (chunks) => (
                <a href={tallyUrl} className={fr.cx('fr-link')}>
                  {chunks}
                </a>
              ),
            })}
          </span>
        </p>
        <Button priority="tertiary no outline" iconId="ri-close-line" size="small" title={t('close')} onClick={handleClose} />
      </div>
    </div>
  )
}
