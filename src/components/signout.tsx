'use client'

import { signOut, useSession } from 'next-auth/react'
import { useEffect } from 'react'

export const Signout = () => {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error) {
      signOut({ callbackUrl: '/', redirect: true })
    }
  }, [session])

  return null
}
