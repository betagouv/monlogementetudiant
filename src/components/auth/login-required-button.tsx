'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import type { FrIconClassName, RiIconClassName } from '@codegouvfr/react-dsfr/fr/generatedFromCss/classNames'
import { ReactNode } from 'react'
import { LoginRequiredModalSingleton, loginRequiredAlertsModal } from '~/components/auth/login-required-modal'

interface LoginRequiredButtonProps {
  modal: LoginRequiredModalSingleton
  children: ReactNode
  priority?: 'primary' | 'secondary' | 'tertiary' | 'tertiary no outline'
  size?: 'small' | 'medium' | 'large'
  iconId?: FrIconClassName | RiIconClassName
  iconPosition?: 'left' | 'right'
  className?: string
  title?: string
}

export const LoginRequiredButton = ({ modal, children, iconId, iconPosition, ...rest }: LoginRequiredButtonProps) => {
  const onClick = () => modal.open()
  if (iconId) {
    return (
      <Button {...rest} iconId={iconId} iconPosition={iconPosition} onClick={onClick}>
        {children}
      </Button>
    )
  }
  return (
    <Button {...rest} onClick={onClick}>
      {children}
    </Button>
  )
}

export const AlertsLoginRequiredButton = (props: Omit<LoginRequiredButtonProps, 'modal'>) => (
  <LoginRequiredButton modal={loginRequiredAlertsModal} {...props} />
)
