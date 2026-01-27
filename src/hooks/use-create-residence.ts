'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'

export const useCreateResidence = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { images_files?: File[] }) => {
      const formData = new FormData()

      const { images_files, ...fields } = data

      for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined) continue
        formData.append(key, String(value))
      }

      if (images_files) {
        images_files.forEach((file) => {
          formData.append('images_files', file)
        })
      }

      const response = await fetch('/api/accommodations/my/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to create residence')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      await queryClient.refetchQueries({
        queryKey: ['my-accommodations'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Résidence créée avec succès',
      })
      if (data?.slug) {
        router.push(`/bailleur/residences/${data.slug}`)
      } else {
        router.push('/bailleur/residences')
      }
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: 'Erreur lors de la création de la résidence',
      })
    },
  })
}
