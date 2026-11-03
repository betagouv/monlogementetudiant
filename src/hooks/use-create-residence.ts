'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsInteger, useQueryStates } from 'nuqs'
import { createToast } from '~/components/ui/createToast'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import { useTRPC } from '~/server/trpc/client'
import { buildHref } from '~/utils/preserve-query-params'

export const useCreateResidence = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const t = useTranslations('toast')
  const [{ ownerId }] = useQueryStates({ ownerId: parseAsInteger })

  return useMutation({
    mutationFn: async (data: TCreateResidence): Promise<{ slug: string }> => {
      const { imagesFiles, imagesUrls: _imagesUrls, ...fields } = data

      const formData = new FormData()
      formData.append('payload', JSON.stringify({ ...fields, ownerId: ownerId ?? undefined }))
      imagesFiles?.forEach((file) => formData.append('images', file))

      const response = await fetch('/api/accommodations/my/', { method: 'POST', body: formData })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || t('residenceCreateError'))
      }
      return response.json()
    },
    onSuccess: async (data) => {
      await queryClient.refetchQueries({
        queryKey: trpc.bailleur.list.queryKey(),
        exact: false,
      })
      createToast({
        priority: 'success',
        message: t('residenceCreated'),
      })
      if (data?.slug) {
        router.push(buildHref(`/bailleur/residences/${data.slug}`, { ownerId: ownerId?.toString() }))
      } else {
        router.push(buildHref('/bailleur/residences', { ownerId: ownerId?.toString() }))
      }
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || t('residenceCreateError'),
      })
    },
  })
}
