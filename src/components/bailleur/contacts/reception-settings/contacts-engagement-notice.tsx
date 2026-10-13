'use client'

import { Notice } from '@codegouvfr/react-dsfr/Notice'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const storageKey = (ownerId: number) => `mle:contacts-engagement-notice-dismissed:${ownerId}`

export const ContactsEngagementNotice = ({ ownerId }: { ownerId: number }) => {
  const t = useTranslations('bailleur.contacts.receptionSettings.engagementNotice')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey(ownerId)) === null)
    } catch {
      setVisible(true)
    }
  }, [ownerId])

  if (!visible) return null

  return (
    <Notice
      className="fr-mb-4w"
      title={t('title')}
      description={t('description')}
      isClosable
      onClose={() => {
        setVisible(false)
        try {
          localStorage.setItem(storageKey(ownerId), new Date().toISOString())
        } catch (error) {
          console.warn('Fermeture de la notice non mémorisée', error)
        }
      }}
    />
  )
}
