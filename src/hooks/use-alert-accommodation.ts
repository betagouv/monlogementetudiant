import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useAlertAccommodation = () => {
  const trpc = useTRPC()

  const { mutateAsync } = useMutation({
    ...trpc.territories.subscribeNewsletter.mutationOptions(),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: 'Votre e-mail a bien été enregistré',
      })
    },
  })

  return {
    mutateAsync,
  }
}
