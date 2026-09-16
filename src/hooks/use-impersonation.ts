'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createToast } from '~/components/ui/createToast'
import { authClient, getRedirectUrlByRole } from '~/services/better-auth-client'

/**
 * Usurpation de compte (plugin `admin` de Better Auth), reservee aux admins plateforme.
 *
 * Les deux bascules rechargent la page par `window.location` plutot que par le routeur Next :
 * le cookie de session vient de changer, et tout ce qui a ete rendu cote serveur (layouts,
 * navigation, prefetchs tRPC) porte encore l'identite precedente.
 */

const ORIGIN_KEY = 'mle-impersonation-origin'
const DEFAULT_RETURN_URL = '/administration/comptes-gestionnaires'

/** `sessionStorage` est indisponible en navigation privee stricte : le retour a un defaut. */
const rememberOrigin = (url: string) => {
  try {
    sessionStorage.setItem(ORIGIN_KEY, url)
  } catch {
    // Sans mémoire, on retombera sur `DEFAULT_RETURN_URL`.
  }
}

const takeOrigin = () => {
  try {
    const url = sessionStorage.getItem(ORIGIN_KEY)
    sessionStorage.removeItem(ORIGIN_KEY)
    return url
  } catch {
    return null
  }
}

export const useStartImpersonation = () => {
  const t = useTranslations('impersonation')
  const [isPending, setIsPending] = useState(false)

  const startImpersonation = async (userId: string) => {
    setIsPending(true)
    rememberOrigin(`${window.location.pathname}${window.location.search}`)

    const { data, error } = await authClient.admin.impersonateUser({ userId })

    if (error) {
      createToast({ priority: 'error', message: error.message || t('startError') })
      setIsPending(false)
      return
    }

    window.location.href = getRedirectUrlByRole(data?.user?.role)
  }

  return { startImpersonation, isPending }
}

export const useStopImpersonation = () => {
  const t = useTranslations('impersonation')
  const [isPending, setIsPending] = useState(false)

  const stopImpersonation = async () => {
    setIsPending(true)
    const { error } = await authClient.admin.stopImpersonating()

    if (error) {
      createToast({ priority: 'error', message: error.message || t('stopError') })
      setIsPending(false)
      return
    }

    window.location.href = takeOrigin() ?? DEFAULT_RETURN_URL
  }

  return { stopImpersonation, isPending }
}
