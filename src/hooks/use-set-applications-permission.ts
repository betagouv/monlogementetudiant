'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useSetApplicationsPermission = (ownerId: number) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const t = useTranslations('bailleur.contacts.moderation')
  const queryKey = trpc.bailleur.users.list.queryKey({ ownerId })

  return useMutation(
    trpc.bailleur.users.setApplicationsPermission.mutationOptions({
      onMutate: async ({ managers }) => {
        await queryClient.cancelQueries({ queryKey })
        const previous = queryClient.getQueryData(queryKey)

        if (previous) {
          queryClient.setQueryData(queryKey, {
            ...previous,
            items: previous.items.map((item) => {
              const assignment = managers.find((m) => m.userId === item.id)
              if (!assignment) return item
              const permissions = item.bailleurPermissions.filter((p) => p !== 'manage_applications')
              return {
                ...item,
                bailleurPermissions: assignment.enabled ? [...permissions, 'manage_applications' as const] : permissions,
              }
            }),
          })
        }

        return { previous }
      },
      onError: (error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
        createToast({ priority: 'error', message: error.message || t('toastError') })
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey }),
    }),
  )
}
