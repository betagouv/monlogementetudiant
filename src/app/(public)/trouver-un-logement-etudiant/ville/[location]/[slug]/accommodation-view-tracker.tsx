'use client'

import { useEffect, useRef } from 'react'
import { useTRPCClient } from '~/server/trpc/client'

export function AccommodationViewTracker({ accommodationId }: { accommodationId: number }) {
  const trpcClient = useTRPCClient()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    void trpcClient.tracking.logAccommodationView
      .mutate({
        accommodationId,
        referer: document.referrer || undefined,
      })
      .catch(() => undefined)
  }, [accommodationId, trpcClient])

  return null
}
