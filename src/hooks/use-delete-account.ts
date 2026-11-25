import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'
import { signOut } from '~/services/better-auth-client'

export const useDeleteAccount = () => {
  const t = useTranslations('student.personalInformations.deleteAccount')
  const trpc = useTRPC()

  return useMutation(
    trpc.student.deleteAccount.mutationOptions({
      onSuccess: async () => {
        await signOut({ callbackUrl: '/', redirect: true })
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('errorToast'),
        })
      },
    }),
  )
}
