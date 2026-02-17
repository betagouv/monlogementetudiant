import { useCallback } from 'react'
import { type MatomoEventCategory, trackEvent } from '~/lib/tracking'

export function useTracking() {
  const track = useCallback(
    ({ category, action, name, value }: { category: MatomoEventCategory; action: string; name?: string; value?: number }) => {
      trackEvent({ category, action, name, value })
    },
    [],
  )

  return { trackEvent: track }
}
