'use client'

import { useEffect } from 'react'
import { authClient, signOut } from '~/services/better-auth-client'

export const Signout = () => {
  const { data: session, error } = authClient.useSession()

  useEffect(() => {
    if (error) {
      signOut({ callbackUrl: '/', redirect: true })
    }
  }, [session])

  return null
}
