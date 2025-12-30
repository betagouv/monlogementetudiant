import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { TForgotPasswordForm } from '~/schemas/forgot-password/forgot-password'

export const postForgotPassword = async (body: TForgotPasswordForm): Promise<void> => {
  const response = await fetch('/api/accounts/students/request-password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Password reset request failed' }))
    throw new Error(errorData.error || 'Password reset request failed')
  }

  return response.json()
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
