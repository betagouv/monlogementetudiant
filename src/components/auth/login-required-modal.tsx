'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'

export const loginRequiredFavoritesModal = createModal({
  id: 'login-required-favorites-modal',
  isOpenedByDefault: false,
})

export const loginRequiredAlertsModal = createModal({
  id: 'login-required-alerts-modal',
  isOpenedByDefault: false,
})

export type LoginRequiredModalSingleton = typeof loginRequiredFavoritesModal

interface LoginRequiredModalProps {
  modal: LoginRequiredModalSingleton
  description: ReactNode
}

export const LoginRequiredModal = ({ modal, description }: LoginRequiredModalProps) => {
  const t = useTranslations('loginRequiredModal')
  return (
    <modal.Component
      title={t('title')}
      iconId="ri-account-circle-line"
      buttons={[
        {
          children: t('login'),
          priority: 'secondary',
          linkProps: { href: '/se-connecter' },
        },
        {
          children: t('signup'),
          priority: 'primary',
          linkProps: { href: '/s-inscrire' },
        },
      ]}
    >
      {description}
    </modal.Component>
  )
}

export const LoginRequiredModals = () => {
  const t = useTranslations('loginRequiredModal')
  return (
    <>
      <LoginRequiredModal modal={loginRequiredFavoritesModal} description={t('description.favorites')} />
      <LoginRequiredModal modal={loginRequiredAlertsModal} description={t('description.alerts')} />
    </>
  )
}
