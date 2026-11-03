'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const validateFiles = (files: File[], t: (key: string, params?: Record<string, string>) => string): string | null => {
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('unsupportedFileType', { fileName: file.name })
    }

    if (file.size > MAX_FILE_SIZE) {
      return t('fileTooLarge', { fileName: file.name })
    }
  }
  return null
}

const useRefreshResidences = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  return async () => {
    await queryClient.refetchQueries({ queryKey: trpc.bailleur.list.queryKey(), exact: false })
    router.refresh()
  }
}

export const useUploadResidenceImages = (slug: string) => {
  const refresh = useRefreshResidences()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: async (files: File[]) => {
      const validationError = validateFiles(files, t)
      if (validationError) {
        throw new Error(validationError)
      }

      const formData = new FormData()
      files.forEach((file) => {
        formData.append('images', file)
      })

      const uploadResponse = await fetch(`/api/accommodations/my/${slug}/upload/`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(errorData.error || t('uploadFailed'))
      }

      const uploadData: { imagesUrls?: string[] } = await uploadResponse.json()
      return { imagesUrls: uploadData.imagesUrls ?? [] }
    },
    onSuccess: async () => {
      trackEvent({ category: 'Espace Gestionnaire', action: 'upload images', name: slug })
      createToast({ priority: 'success', message: t('imagesUploaded') })
      await refresh()
    },
    onError: (error: Error) => {
      createToast({ priority: 'error', message: error.message || t('imagesUploadError') })
    },
  })
}

export const useDeleteResidenceImage = (slug: string) => {
  const refresh = useRefreshResidences()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (imageUrl: string) => trpcClient.bailleur.removeImage.mutate({ slug, imageUrl }),
    onSuccess: async () => {
      createToast({ priority: 'success', message: t('imageDeleted') })
      await refresh()
    },
    onError: () => {
      createToast({ priority: 'error', message: t('imageDeleteError') })
    },
  })
}

export const useReorderResidenceImages = (slug: string) => {
  const refresh = useRefreshResidences()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (imagesUrls: string[]) => trpcClient.bailleur.reorderImages.mutate({ slug, imagesUrls }),
    onSuccess: async () => {
      createToast({ priority: 'success', message: t('residenceUpdated') })
      await refresh()
    },
    onError: () => {
      createToast({ priority: 'error', message: t('residenceUpdateError') })
    },
  })
}
