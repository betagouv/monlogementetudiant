'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const validateFiles = (files: File[]): string | null => {
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Type de fichier non supporté: ${file.name}. Types acceptés: JPEG, PNG, WebP`
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

      const patchResponse = await fetch(`/api/accommodations/my/${slug}?type=details`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images_urls: allImages, name }),
      })

      if (!patchResponse.ok) {
        throw new Error('Failed to save image URLs to accommodation')
      }

      return { images_urls: allImages }
    },
    onSuccess: async (_data, variables) => {
      trackEvent({ category: 'Espace Gestionnaire', action: 'upload images', name: slug, value: variables.files.length })
      await queryClient.refetchQueries({
        queryKey: ['my-accommodations'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Images uploadées avec succès',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Erreur lors de l'upload des images",
      })
    },
  })
}

export const useDeleteResidenceImage = (slug: string, name: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (remainingImages: string[]) => {
      const response = await fetch(`/api/accommodations/my/${slug}?type=details`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images_urls: remainingImages, name }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['my-accommodations'] })
      createToast({
        priority: 'success',
        message: 'Image supprimée avec succès',
      })
      router.refresh()
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: "Erreur lors de la suppression de l'image",
      })
    },
  })
}
