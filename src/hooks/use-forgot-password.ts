import { useMutation } from '@tanstack/react-query'
import { authClient } from '~/auth-client'
import { createToast } from '~/components/ui/createToast'
import { TForgotPasswordForm } from '~/schemas/forgot-password/forgot-password'

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
  const { mutateAsync, isPending, isSuccess } = useMutation({
    mutationFn: async (data: TForgotPasswordForm) => postForgotPassword(data),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: 'Un email de réinitialisation de mot de passe a été envoyé à votre adresse email.',
      })
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || 'Une erreur est survenue lors de la demande de réinitialisation.',
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
    isSuccess,
  }
}
