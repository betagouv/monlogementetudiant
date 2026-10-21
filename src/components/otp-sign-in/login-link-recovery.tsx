'use client'

import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { FC, ReactNode, useEffect, useState } from 'react'
import { recoverLoginWithBinding } from './actions'

export const LoginLinkRecovery: FC<{ verifyUrl: string; callbackURL: string; fallback: ReactNode }> = ({
  verifyUrl,
  callbackURL,
  fallback,
}) => {
  const t = useTranslations('verification.buffer')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    recoverLoginWithBinding(verifyUrl)
      .then(({ success }) => {
        if (success) window.location.assign(callbackURL)
        else setFailed(true)
      })
      .catch((error) => {
        Sentry.captureException(error, { tags: { feature: 'otp-sign-in' } })
        setFailed(true)
      })
  }, [verifyUrl, callbackURL])

  if (failed) return fallback
  return <p role="status">{t('recovering')}</p>
}
