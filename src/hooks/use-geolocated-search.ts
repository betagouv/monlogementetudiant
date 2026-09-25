import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const PRESERVED_PARAMS = ['colocation', 'accessible', 'prix', 'crous', 'disponible']

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }),
  )

export const useGeolocatedSearch = () => {
  const t = useTranslations('geolocation')
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const [isLocating, setIsLocating] = useState(false)
  const [isNavigating, startTransition] = useTransition()

  const locate = async () => {
    if (!('geolocation' in navigator)) {
      createToast({ priority: 'warning', message: t('unsupported') })
      return
    }
    setIsLocating(true)
    try {
      const { coords } = await getCurrentPosition()
      const city = await queryClient.fetchQuery(
        trpc.territories.findCityByCoordinates.queryOptions({ latitude: coords.latitude, longitude: coords.longitude }),
      )
      if (!city) {
        createToast({ priority: 'warning', message: t('notFound') })
        return
      }
      trackEvent({ category: 'Recherche', action: 'geolocalisation', name: city.name })
      trpcClient.tracking.logSearch.mutate({ type: 'city', id: city.id }).catch(() => undefined)

      const searchParams = new URLSearchParams()
      for (const param of PRESERVED_PARAMS) {
        const value = currentSearchParams.get(param)
        if (value) searchParams.set(param, value)
      }
      const query = searchParams.toString()
      startTransition(() => router.push(`/trouver-un-logement-etudiant/ville/${city.slug}${query ? `?${query}` : ''}`))
    } catch (error) {
      const isDenied = typeof error === 'object' && error !== null && 'code' in error && error.code === 1
      createToast({ priority: isDenied ? 'warning' : 'error', message: isDenied ? t('denied') : t('unavailable') })
    } finally {
      setIsLocating(false)
    }
  }

  return { locate, isLocating: isLocating || isNavigating }
}
