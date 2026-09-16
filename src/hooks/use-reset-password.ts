import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { TResetPasswordForm } from '~/schemas/reset-password/reset-password'
import { authClient } from '~/services/better-auth-client'

interface ResetPasswordPayload extends TResetPasswordForm {
  token: string
}

export const postResetPassword = async ({ token, password }: ResetPasswordPayload): Promise<void> => {
  const result = await authClient.resetPassword({
    newPassword: password,
    token,
  })

  if (result.error) {
    throw new Error(result.error.message || 'Password reset failed')
  }
}

export const useResetPassword = () => {
  const t = useTranslations('resetPassword')
  const { mutateAsync, isPending, isSuccess } = useMutation({
    mutationFn: async (data: ResetPasswordPayload) => postResetPassword(data),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: t('successToast'),
      })
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || t('errorToast'),
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
    isSuccess,
  }
}
