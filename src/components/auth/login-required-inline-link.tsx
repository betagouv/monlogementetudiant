'use client'

import { ReactNode } from 'react'
import { LoginRequiredModalSingleton, loginRequiredAlertsModal } from '~/components/auth/login-required-modal'

interface LoginRequiredInlineLinkProps {
  modal: LoginRequiredModalSingleton
  className?: string
  children: ReactNode
}

export const LoginRequiredInlineLink = ({ modal, className, children }: LoginRequiredInlineLinkProps) => (
  <button
    type="button"
    className={className}
    style={{ color: 'unset', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
    onClick={() => modal.open()}
  >
    {children}
  </button>
)

export const AlertsLoginRequiredInlineLink = (props: Omit<LoginRequiredInlineLinkProps, 'modal'>) => (
  <LoginRequiredInlineLink modal={loginRequiredAlertsModal} {...props} />
)
