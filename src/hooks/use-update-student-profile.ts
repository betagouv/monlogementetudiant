import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'
import { authClient } from '~/services/better-auth-client'

export const useUpdateStudentProfile = () => {
  const t = useTranslations('student.personalInformations.form')
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    trpc.student.updateProfile.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.student.getProfile.queryKey() })
        // La mise à jour passe par tRPC, hors de better-auth : sans ce signal, `useSession` continue
        // de servir l'ancien instantané et les formulaires pré-remplis (candidature) restent vides.
        authClient.$store.notify('$sessionSignal')
        createToast({ priority: 'success', message: t('updatedToast') })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('updateErrorToast'),
        })
      },
    }),
  )
}
