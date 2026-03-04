'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useRouter } from 'next/navigation'
import { useCreateFavorite } from '~/hooks/use-create-favorite'
import { useDeleteFavorite } from '~/hooks/use-delete-favorite'
import { useFavorites } from '~/hooks/use-favorites'
import { TUser } from '~/lib/external-auth-plugin'
import { trackEvent } from '~/lib/tracking'

export const FAVORITE_BUTTON_TITLES = {
  ADD: 'Enregistrer en favoris',
  REMOVE: 'Supprimer des favoris',
} as const

export const SaveAccommodationFavoriteButton = ({ slug, withLabel = false, user }: { slug: string; withLabel?: boolean; user?: TUser }) => {
  const router = useRouter()

  const { data: favorites } = useFavorites(user)

  const { mutateAsync, isLoading } = useCreateFavorite()
  const { mutateAsync: mutationDelete, isLoading: isLoadingDelete } = useDeleteFavorite()

  const handleSave = async () => {
    if (!user) {
      router.push('/s-inscrire')
      return
    }
    await mutateAsync({ accommodationSlug: slug })
    trackEvent({ category: 'Favoris', action: 'ajout favori', name: slug })
  }
  const handleDelete = async () => {
    await mutationDelete({ slug })
    trackEvent({ category: 'Favoris', action: 'suppression favori', name: slug })
  }

  if (favorites?.find((favorite) => favorite.accommodation.properties.slug === slug)) {
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
        Ajouter en favoris
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
