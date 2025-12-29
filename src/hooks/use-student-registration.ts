import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { TSignUpForm } from '~/schemas/sign-up/sign-up'

export const postStudentRegistration = async (body: TSignUpForm): Promise<void> => {
  const response = await fetch('/api/accounts/students/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Registration failed' }))
    throw new Error(errorData.error || 'Registration failed')
  }

  return response.json()
}

export const useStudentRegistration = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TSignUpForm) => postStudentRegistration(data),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: "Inscription réussie ! Vous allez recevoir un email de confirmation avec un lien vous permettant d'activer votre compte.",
      })
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Une erreur est survenue lors de l'inscription.",
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
