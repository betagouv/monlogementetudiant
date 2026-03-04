import { useMutation } from '@tanstack/react-query'
import { authClient } from '~/auth-client'
import { createToast } from '~/components/ui/createToast'
import { TResetPasswordForm } from '~/schemas/reset-password/reset-password'

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
  const { mutateAsync, isPending, isSuccess } = useMutation({
    mutationFn: async (data: ResetPasswordPayload) => postResetPassword(data),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: 'Votre mot de passe a été réinitialisé avec succès.',
      })
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || 'Une erreur est survenue lors de la réinitialisation du mot de passe.',
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
    isSuccess,
  }
}
