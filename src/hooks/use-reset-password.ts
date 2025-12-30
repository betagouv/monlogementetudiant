import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { TResetPasswordForm } from '~/schemas/reset-password/reset-password'

interface ResetPasswordPayload extends TResetPasswordForm {
  id: string
  token: string
}

export const postResetPassword = async ({ id, token, password }: ResetPasswordPayload): Promise<void> => {
  const response = await fetch(`/api/accounts/students/password-reset-confirm/${id}/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_password: password }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Password reset failed' }))
    throw new Error(errorData.error || 'Password reset failed')
  }

  return response.json()
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
