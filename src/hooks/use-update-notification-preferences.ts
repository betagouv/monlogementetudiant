import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useUpdateNotificationPreferences = () => {
  const t = useTranslations('student.personalInformations.notifications')
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  return useMutation(
    trpc.student.updateNotificationPreferences.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.student.getNotificationPreferences.queryKey(),
        })
        createToast({ priority: 'success', message: t('updatedToast') })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('updateErrorToast'),
        })
      },
    }),
  )
}
