'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

export const useCreateResidence = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: TCreateResidence) => {
      const response = await fetch('/api/accommodations/my', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cache: 'no-store',
        },
        body: JSON.stringify(data),
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
      // Redirect to the edit page with the new slug
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
