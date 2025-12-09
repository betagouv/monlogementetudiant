'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'

export const useUpdateAccommodation = (slug: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: TUpdateResidenceList) => {
      const response = await fetch(`/api/accommodations/my/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cache: 'no-store',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update accommodation')
      }

      return response.json()
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['my-accommodations'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Résidence mise à jour avec succès',
      })
      router.refresh()
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: 'Erreur lors de la mise à jour de la résidence',
      })
    },
  })
}
