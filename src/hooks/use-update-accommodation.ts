'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'

export const useUpdateAccommodation = (slug: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TUpdateResidenceList) => {
      const response = await fetch(`/api/accommodations/my/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update accommodation')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'my-accommodations',
      })
    },
  })
}
