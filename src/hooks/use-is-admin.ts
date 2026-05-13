'use client'

import { authClient } from '~/services/better-auth-client'

export const useIsAdmin = () => {
  const { data: session } = authClient.useSession()
  return session?.user?.role === 'admin'
}
