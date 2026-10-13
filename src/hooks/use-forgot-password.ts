import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { TForgotPasswordForm } from '~/schemas/forgot-password/forgot-password'
import { authClient } from '~/services/better-auth-client'

export const postForgotPassword = async (body: TForgotPasswordForm): Promise<void> => {
  const result = await authClient.requestPasswordReset({
    email: body.email,
    redirectTo: '/reinitialiser-son-mot-de-passe',
  })

  if (result.error) {
    throw new Error(result.error.message || 'Password reset request failed')
  }
}

export const useForgotPassword = () => {
  const t = useTranslations('forgotPassword')
  const { mutateAsync, isPending, isSuccess } = useMutation({
    mutationFn: async (data: TForgotPasswordForm) => postForgotPassword(data),
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
