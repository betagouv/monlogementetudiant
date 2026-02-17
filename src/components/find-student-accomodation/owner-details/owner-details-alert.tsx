'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useAlertAccommodation } from '~/hooks/use-alert-accommodation'
import { trackEvent } from '~/lib/tracking'
import styles from './owner-details-alert.module.css'

interface OwnerDetailsAlertProps {
  location: string
}

export const OwnerDetailsAlert = ({ location }: OwnerDetailsAlertProps) => {
  const t = useTranslations('accomodation.sidebar.alert')
  const [email, setEmail] = useState('')
  const { mutateAsync } = useAlertAccommodation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    try {
      await mutateAsync({
        email,
        territory_name: location,
        territory_type: 'city',
        kind: 'accommodation',
      })
      trackEvent({ category: 'Alertes', action: 'inscription alerte logement', name: location })
      setEmail('')
    } catch (error) {
      console.error('Error subscribing to alert:', error)
    }
  }

  return (
    <div className={styles.container}>
      <span className={clsx(styles.title, 'fr-text--bold fr-h6 fr-mb-0')}>{t('title')}</span>
      <form onSubmit={handleSubmit}>
        <div>
          <Input
            addon={<Button type="submit">{t('subscribe')}</Button>}
            label={t('label')}
            nativeInputProps={{
              placeholder: t('label'),
              value: email,
              onChange: (e) => setEmail(e.target.value),
              type: 'email',
            }}
            className={styles.input}
          />
          <p className="fr-mb-0 fr-text--xs">{t('description')}</p>
        </div>
      </form>
    </div>
  )
}
