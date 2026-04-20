'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import type { CreateBailleurUserInput, UpdateBailleurUserInput } from '~/schemas/bailleur-users/bailleur-user-form'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useBailleurUsers = (params: { search?: string; ownerId?: number } = {}) => {
  const trpc = useTRPC()
  return useQuery(trpc.bailleur.users.list.queryOptions(params))
}

export const useBailleurUser = (id: string, ownerId?: number) => {
  const trpc = useTRPC()
  return useQuery(trpc.bailleur.users.getById.queryOptions({ id, ownerId }))
}

export const useCreateBailleurUser = () => {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const t = useTranslations('bailleur.users.toast')

  return useMutation({
    mutationFn: (data: CreateBailleurUserInput & { ownerId?: number }) => trpcClient.bailleur.users.create.mutate(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.bailleur.users.list.queryKey() })
      createToast({ priority: 'success', message: t('created') })
      router.push('/bailleur/utilisateurs')
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('createError') })
    },
  })
}

export const useUpdateBailleurUser = () => {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const t = useTranslations('bailleur.users.toast')

  return useMutation({
    mutationFn: (data: UpdateBailleurUserInput & { ownerId?: number }) => trpcClient.bailleur.users.update.mutate(data),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.bailleur.users.list.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.bailleur.users.getById.queryKey({ id: variables.id, ownerId: variables.ownerId }) }),
      ])
      createToast({ priority: 'success', message: t('updated') })
      router.push('/bailleur/utilisateurs')
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('updateError') })
    },
  })
}

export const useDeleteBailleurUser = () => {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const t = useTranslations('bailleur.users.toast')

  return useMutation({
    mutationFn: (params: { id: string; ownerId?: number }) => trpcClient.bailleur.users.delete.mutate(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.bailleur.users.list.queryKey() })
      createToast({ priority: 'success', message: t('deleted') })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('deleteError') })
    },
  })
}
