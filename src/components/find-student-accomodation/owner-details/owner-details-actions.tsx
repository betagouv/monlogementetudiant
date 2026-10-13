'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { tss } from 'tss-react'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { formatCityWithPreposition } from '~/utils/french-contraction'

export const OwnerDetailsActions = ({ title, location }: { title: string; location: string }) => {
  const t = useTranslations('accomodation')
  const locale = useLocale()
  const { classes } = useStyles()
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    setCurrentUrl(window.location.href)
  }, [])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      trackEvent({ category: 'Logement', action: 'partage copie lien' })
      createToast({
        priority: 'success',
        message: t('sidebar.copySuccess'),
      })
    } catch {
      createToast({
        priority: 'error',
        message: t('sidebar.copyError'),
      })
    }
  }, [currentUrl, t])

  const handlePrint = useCallback(() => {
    trackEvent({ category: 'Logement', action: 'partage impression' })
    window.print()
  }, [])

  const locationFormatted = formatCityWithPreposition(locale, 'à', location)
  const mailtoUrl = `mailto:?subject=${t('sidebar.emailSubject', { locationFormatted, title })}&body=${encodeURIComponent(t('sidebar.emailBody', { url: currentUrl, location, locationFormatted, title }))}`

  return (
    <div className={classes.sidebarShare}>
      <p className="fr-m-0">{t('sidebar.share')}</p>
      <div className={classes.buttonGroup}>
        <Button size="small" iconId="ri-links-line" priority="tertiary" title={t('sidebar.buttons.link')} onClick={handleCopyLink} />
        <Button
          size="small"
          iconId="ri-mail-line"
          priority="tertiary"
          title={t('sidebar.buttons.email')}
          linkProps={{ href: mailtoUrl, onClick: () => trackEvent({ category: 'Logement', action: 'partage email' }) }}
        />
        <Button size="small" iconId="ri-printer-line" priority="tertiary" title={t('sidebar.buttons.print')} onClick={handlePrint} />
      </div>
    </div>
  )
}

export const useStyles = tss.create({
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
  },
  sidebarShare: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
})
