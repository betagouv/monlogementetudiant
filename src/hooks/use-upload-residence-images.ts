'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const validateFiles = (files: File[]): string | null => {
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Type de fichier non supporte: ${file.name}. Types acceptes: JPEG, PNG, WebP`
    }

    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux: ${file.name}. Taille maximale: 10MB`
    }
  }
  return null
}

export const useUploadResidenceImages = (slug: string, name: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: async ({ files, currentImages }: { files: File[]; currentImages: string[] }) => {
      const validationError = validateFiles(files)
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
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload images')
      }

      const uploadData = await uploadResponse.json()
      const newImageUrls = uploadData.images_urls || []
      const allImages = [...currentImages, ...newImageUrls]

      // Save image URLs via tRPC update
      await trpcClient.bailleur.update.mutate({
        slug,
        images_urls: allImages,
        name,
      })

      return { images_urls: allImages }
    },
    onSuccess: async () => {
      trackEvent({ category: 'Espace Gestionnaire', action: 'upload images', name: slug })
      await queryClient.refetchQueries({
        queryKey: trpc.bailleur.list.queryKey(),
        exact: false,
      })
      createToast({
        priority: 'success',
        message: t('imagesUploaded'),
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || t('imagesUploadError'),
      })
    },
  })
}

export const useDeleteResidenceImage = (slug: string, name: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: async (remainingImages: string[]) => {
      return trpcClient.bailleur.update.mutate({
        slug,
        images_urls: remainingImages,
        name,
      })
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: trpc.bailleur.list.queryKey() })
      createToast({
        priority: 'success',
        message: t('imageDeleted'),
      })
      router.refresh()
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: t('imageDeleteError'),
      })
    },
  })
}
