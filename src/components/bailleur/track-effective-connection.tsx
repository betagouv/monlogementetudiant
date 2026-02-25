'use client'

import { useEffect } from 'react'
import { authClient } from '~/auth-client'
import { trackEvent } from '~/lib/tracking'

const SESSION_KEY = 'matomo_connexion_effective_tracked'

export const TrackEffectiveConnection = () => {
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return
    if (!session?.user?.email) return
    sessionStorage.setItem(SESSION_KEY, '1')
    trackEvent({ category: 'Espace Gestionnaire', action: 'connexion', name: session.user.email })
  }, [session?.user?.email])

  return null
}
