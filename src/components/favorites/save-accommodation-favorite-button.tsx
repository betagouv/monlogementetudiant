'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authClient } from '~/auth-client'
import { useCreateFavorite } from '~/hooks/use-create-favorite'
import { useDeleteFavorite } from '~/hooks/use-delete-favorite'
import { useFavorites } from '~/hooks/use-favorites'
import { trackEvent } from '~/lib/tracking'
import { TPostFavorite, ZPostFavorite } from '~/schemas/favorites/create-favorite'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const FAVORITE_BUTTON_TITLES = {
  ADD: 'Enregistrer en favoris',
  REMOVE: 'Supprimer des favoris',
} as const

export const SaveAccommodationFavoriteButton = ({
  slug,
  withLabel = false,
  initialFavorites,
}: {
  slug: string
  withLabel?: boolean
  initialFavorites?: TGetFavoritesResponse | null
}) => {
  const { data: session } = authClient.useSession()
  const router = useRouter()

  const { data: favorites } = useFavorites(initialFavorites)

  const { getValues } = useForm<TPostFavorite>({
    defaultValues: {
      accommodation_slug: slug,
    },
    resolver: zodResolver(ZPostFavorite),
  })

  const { mutateAsync, isLoading } = useCreateFavorite()
  const { mutateAsync: mutationDelete, isLoading: isLoadingDelete } = useDeleteFavorite()

  const handleSave = async () => {
    if (!session) {
      router.push('/s-inscrire')
      return
    }
    await mutateAsync(getValues())
    trackEvent({ category: 'Favoris', action: 'ajout favori', name: slug })
  }
  const handleDelete = async () => {
    await mutationDelete(slug)
    trackEvent({ category: 'Favoris', action: 'suppression favori', name: slug })
  }

  if (favorites?.results.find((favorite) => favorite.accommodation.properties.slug === slug)) {
    if (withLabel) {
      return (
        <Button
          priority="secondary"
          title={FAVORITE_BUTTON_TITLES.REMOVE}
          iconId="ri-heart-fill"
          size="small"
          disabled={isLoadingDelete}
          nativeButtonProps={{
            onClick: handleDelete,
          }}
        >
          Retirer des favoris
        </Button>
      )
    }
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

  if (withLabel) {
    return (
      <Button
        priority="secondary"
        title={FAVORITE_BUTTON_TITLES.ADD}
        iconId="ri-heart-line"
        size="small"
        disabled={isLoading}
        nativeButtonProps={{ onClick: handleSave }}
      >
        Ajouter aux favoris
      </Button>
    )
  }
  return (
    <Button
      priority="secondary"
      title={FAVORITE_BUTTON_TITLES.ADD}
      iconId="ri-heart-line"
      size="small"
      disabled={isLoading}
      nativeButtonProps={{ onClick: handleSave }}
    />
  )
}
