'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useCreateFavorite } from '~/hooks/use-create-favorite'
import { useDeleteFavorite } from '~/hooks/use-delete-favorite'
import { useFavorites } from '~/hooks/use-favorites'
import { TPostFavorite, ZPostFavorite } from '~/schemas/favorites/create-favorite'

export const SaveAccommodationFavoriteButton = ({ slug }: { slug: string }) => {
  const { data: favorites } = useFavorites()

  const { getValues } = useForm<TPostFavorite>({
    defaultValues: {
      accommodation_slug: slug,
    },
    resolver: zodResolver(ZPostFavorite),
  })

  const { mutateAsync, isLoading } = useCreateFavorite()
  const { mutateAsync: mutationDelete, isLoading: isLoadingDelete } = useDeleteFavorite()

  const handleSave = async () => await mutateAsync(getValues())
  const handleDelete = async () => await mutationDelete(slug)

  if (favorites?.results.find((favorite) => favorite.accommodation.properties.slug === slug)) {
    return (
      <Button
        priority="tertiary"
        title="Supprimer des favoris"
        iconId="ri-heart-fill"
        size="small"
        disabled={isLoadingDelete}
        nativeButtonProps={{
          onClick: handleDelete,
        }}
      />
    )
  }

  return (
    <Button
      priority="tertiary"
      title="Enregistrer en favoris"
      iconId="ri-heart-line"
      size="small"
      disabled={isLoading}
      nativeButtonProps={{ onClick: handleSave }}
    />
  )
}
