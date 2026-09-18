'use client'

import { trackAppRouter } from '@socialgouv/matomo-next'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function Matomo({ nonce }: { nonce?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
      trackAppRouter({
        url: process.env.NEXT_PUBLIC_MATOMO_URL || '',
        siteId: process.env.NEXT_PUBLIC_MATOMO_SITE_ID || '',
        disableCookies: true,
        enableHeartBeatTimer: true,
        nonce,
      })
    }
  }, [pathname, searchParams, nonce])

  return null
}
