import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { classifyGeolocationError, type GeolocationFailure, systemLocationSettingsUrl } from '~/utils/geolocation-settings'

const PRESERVED_PARAMS = ['colocation', 'accessible', 'prix', 'crous', 'disponible']
const TOAST_ID = 'geolocation'
const FAILURE_TOAST_DURATION = 20000

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }),
  )

const geolocationPermission = async () => {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? null
  } catch {
    return null
  }
}

const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number' ? error.code : undefined

export const useGeolocatedSearch = () => {
  const t = useTranslations('geolocation')
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const [isLocating, setIsLocating] = useState(false)
  const [isNavigating, startTransition] = useTransition()

  const notifyFailure = (failure: GeolocationFailure) => {
    if (failure === 'denied') {
      createToast({
        id: TOAST_ID,
        priority: 'warning',
        message: t('denied'),
        duration: FAILURE_TOAST_DURATION,
        action: { children: t('retry'), onClick: () => void locate() },
      })
      return
    }
    if (failure === 'deniedBySystem') {
      const settingsUrl = systemLocationSettingsUrl(navigator)
      createToast({
        id: TOAST_ID,
        priority: 'warning',
        message: t('deniedBySystem'),
        duration: FAILURE_TOAST_DURATION,
        action: settingsUrl
          ? {
              children: t('openSystemSettings'),
              onClick: () => {
                window.location.href = settingsUrl
              },
            }
          : undefined,
      })
      return
    }
    createToast({ id: TOAST_ID, priority: 'error', message: t('unavailable') })
  }

  const locate = async () => {
    if (!('geolocation' in navigator)) {
      createToast({ id: TOAST_ID, priority: 'warning', message: t('unsupported') })
      return
    }
    setIsLocating(true)
    try {
      let coords: GeolocationCoordinates
      try {
        ;({ coords } = await getCurrentPosition())
      } catch (error) {
        notifyFailure(classifyGeolocationError(errorCode(error), await geolocationPermission()))
        return
      }
      toast.dismiss(TOAST_ID)

      const city = await queryClient.fetchQuery(
        trpc.territories.findCityByCoordinates.queryOptions({ latitude: coords.latitude, longitude: coords.longitude }),
      )
      if (!city) {
        createToast({ id: TOAST_ID, priority: 'warning', message: t('notFound') })
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
    } catch {
      notifyFailure('unavailable')
    } finally {
      setIsLocating(false)
    }
  }

  return { locate, isLocating: isLocating || isNavigating }
}
