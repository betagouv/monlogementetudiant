import { useMutation } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { TAlertAccommodationForm } from '~/schemas/alert-accommodation/alert-accommodation'

export const postSubscribeToBrevo = async (body: TAlertAccommodationForm): Promise<void> => {
  const response = await fetch('/api/territories/brevo/subscribe', {
    body: JSON.stringify(body),
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error('Error occurred calling API retrieving territories')
  }
  return response.json()
}

export const useAlertAccommodation = () => {
  const { mutateAsync } = useMutation({
    mutationFn: async (data: TAlertAccommodationForm) => postSubscribeToBrevo(data),
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
