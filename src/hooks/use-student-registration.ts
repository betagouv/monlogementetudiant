import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
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
    phone: body.phone,
    birthdate: body.birthdate,
    scholarshipStatus: body.scholarshipStatus,
    // Après activation, l'étudiant est renvoyé vers la page de connexion (réassurance).
    callbackURL: '/se-connecter?activated=1',
  })

  if (result.error) {
    // Ne pas divulguer qu'un compte existe déjà : on traite ce cas comme un succès
    // pour afficher le même message générique (anti-énumération).
    if (result.error.code === 'USER_ALREADY_EXISTS') return
    throw new Error(result.error.message || 'Registration failed')
  }
}

export const useStudentRegistration = () => {
  const t = useTranslations('signUp')
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TSignUpForm) => postStudentRegistration(data),
    onSuccess: () => {
      trackEvent({ category: 'Authentification', action: 'inscription', name: 'succes' })
      createToast({
        priority: 'success',
        message: t('successToast'),
      })
    },
    onError: (error: Error) => {
      trackEvent({ category: 'Authentification', action: 'inscription', name: 'erreur' })
      createToast({
        priority: 'error',
        message: error.message || t('errorToast'),
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
