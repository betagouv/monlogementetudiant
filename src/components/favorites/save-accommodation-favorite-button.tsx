'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useCreateFavorite } from '~/hooks/use-create-favorite'
import { useDeleteFavorite } from '~/hooks/use-delete-favorite'
import { useFavorites } from '~/hooks/use-favorites'
import { TPostFavorite, ZPostFavorite } from '~/schemas/favorites/create-favorite'

export const FAVORITE_BUTTON_TITLES = {
  ADD: 'Enregistrer en favoris',
  REMOVE: 'Supprimer des favoris',
} as const

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
        title={FAVORITE_BUTTON_TITLES.REMOVE}
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
      title={FAVORITE_BUTTON_TITLES.ADD}
      iconId="ri-heart-line"
      size="small"
      disabled={isLoading}
      nativeButtonProps={{ onClick: handleSave }}
    />
  )
}
