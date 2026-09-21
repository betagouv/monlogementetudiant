'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { loginRequiredFavoritesModal } from '~/components/auth/login-required-modal'
import { LiveRegion } from '~/components/ui/live-region'
import { useCreateFavorite } from '~/hooks/use-create-favorite'
import { useDeleteFavorite } from '~/hooks/use-delete-favorite'
import { useFavorites } from '~/hooks/use-favorites'
import { trackEvent } from '~/lib/tracking'
import { TUser } from '~/lib/types'

export const SaveAccommodationFavoriteButton = ({ slug, withLabel = false, user }: { slug: string; withLabel?: boolean; user?: TUser }) => {
  const t = useTranslations('accomodation.favoriteButton')
  const { data: favorites } = useFavorites(user)
  const [announcement, setAnnouncement] = useState('')

  const { mutateAsync, isLoading } = useCreateFavorite()
  const { mutateAsync: mutationDelete, isLoading: isLoadingDelete } = useDeleteFavorite()

  const handleSave = async () => {
    if (!user) {
      loginRequiredFavoritesModal.open()
      return
    }
    await mutateAsync({ accommodationSlug: slug })
    setAnnouncement(t('addedAnnouncement'))
    trackEvent({ category: 'Favoris', action: 'ajout favori', name: slug })
  }
  const handleDelete = async () => {
    await mutationDelete({ slug })
    setAnnouncement(t('removedAnnouncement'))
    trackEvent({ category: 'Favoris', action: 'suppression favori', name: slug })
  }

  const isFavorite = Boolean(favorites?.find((favorite) => favorite.accommodation.slug === slug && favorite.isFavorite))
  // `favorites` liste aussi les résidences suivies via une candidature sans favori : sans le test
  // sur `isFavorite`, leur cœur s'afficherait plein à tort partout sur le site.
  const buttonProps = isFavorite
    ? {
        title: t('removeTitle'),
        iconId: 'ri-heart-fill' as const,
        disabled: isLoadingDelete,
        nativeButtonProps: { onClick: handleDelete, 'aria-pressed': true },
        label: t('removeLabel'),
      }
    : {
        title: t('addTitle'),
        iconId: 'ri-heart-line' as const,
        disabled: isLoading,
        nativeButtonProps: { onClick: handleSave, 'aria-pressed': false },
        label: t('addLabel'),
      }

  return (
    <>
      <Button
        priority={withLabel || !isFavorite ? 'secondary' : 'tertiary'}
        title={buttonProps.title}
        iconId={buttonProps.iconId}
        size="small"
        disabled={buttonProps.disabled}
        nativeButtonProps={buttonProps.nativeButtonProps}
      >
        {withLabel ? buttonProps.label : undefined}
      </Button>
      <LiveRegion message={announcement} />
    </>
  )
}
