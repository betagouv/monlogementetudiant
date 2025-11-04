'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const useUpdateResidenceDetails = (slug: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TUpdateResidence) => {
      const response = await fetch(`/api/accommodations/my/${slug}?type=details`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update residence details')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-accommodations'] })
      createToast({
        priority: 'success',
        message: 'Résidence mise à jour avec succès',
      })
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: 'Erreur lors de la mise à jour de la résidence',
      })
    },
  })
}
