import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { TSignUpForm } from '~/schemas/sign-up/sign-up'
import { authClient } from '~/services/better-auth-client'

export const postStudentRegistration = async (body: TSignUpForm): Promise<void> => {
  const result = await authClient.signUp.email({
    email: body.email,
    password: body.password,
    name: `${body.firstname} ${body.lastname}`.trim(),
    firstname: body.firstname,
    lastname: body.lastname,
  })

  if (result.error) {
    throw new Error(result.error.message || 'Registration failed')
  }
}

export const useStudentRegistration = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TSignUpForm) => postStudentRegistration(data),
    onSuccess: () => {
      trackEvent({ category: 'Authentification', action: 'inscription', name: 'succes' })
      createToast({
        priority: 'success',
        message: "Inscription réussie ! Vous allez recevoir un email de confirmation avec un lien vous permettant d'activer votre compte.",
      })
    },
    onError: (error: Error) => {
      trackEvent({ category: 'Authentification', action: 'inscription', name: 'erreur' })
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
