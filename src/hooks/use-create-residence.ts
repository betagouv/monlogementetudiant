'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useCreateResidence = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: async (data: TCreateResidence) => {
      const { images_files, ...fields } = data

      // 1. Create residence via tRPC (name is always provided by the form)
      const result = await trpcClient.bailleur.create.mutate({
        ...fields,
        name: fields.name!,
      })

      // 2. Upload images via S3 route if provided
      if (images_files?.length && result.slug) {
        const formData = new FormData()
        images_files.forEach((file) => formData.append('images', file))

        const uploadResponse = await fetch(`/api/accommodations/my/${result.slug}/upload/`, {
          method: 'POST',
          body: formData,
        })

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          const imageUrls: string[] = uploadData.images_urls || []
          if (imageUrls.length > 0) {
            // 3. Save image URLs via tRPC update
            await trpcClient.bailleur.update.mutate({
              slug: result.slug,
              images_urls: imageUrls,
              name: fields.name,
            })
          }
        }
      }

      return result
    },
    onSuccess: async (data) => {
      await queryClient.refetchQueries({
        queryKey: trpc.bailleur.list.queryKey(),
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Residence creee avec succes',
      })
      if (data?.slug) {
        router.push(`/bailleur/residences/${data.slug}`)
      } else {
        router.push('/bailleur/residences')
      }
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: 'Erreur lors de la creation de la residence',
      })
    },
  })
}
