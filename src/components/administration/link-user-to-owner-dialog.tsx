'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { getAvatarColor, getInitials } from '~/utils/avatar'
import { formatDateTime } from '~/utils/formatDate'
import dialogStyles from './link-dialog.module.css'

const linkUserToOwnerModal = createModal({
  id: 'link-user-to-owner-modal',
  isOpenedByDefault: false,
})

interface LinkUserToOwnerDialogProps {
  ownerId: number
  ownerName: string
}

export function LinkUserToOwnerDialog({ ownerId, ownerName }: LinkUserToOwnerDialogProps) {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [debouncedSearch] = useDebounce(search, 300)

  const { data: usersData } = useQuery({
    ...trpc.admin.users.list.queryOptions({ page: 1, search: debouncedSearch, unlinked: true }),
    enabled: debouncedSearch.length >= 2,
  })

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return
      await trpcClient.admin.users.linkToOwner.mutate({ userId: selectedUserId, ownerId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: ownerId }) })
      createToast({ priority: 'success', message: 'Utilisateur lié au gestionnaire avec succès' })
      linkUserToOwnerModal.close()
      resetState()
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la liaison' })
    },
  })

  const resetState = () => {
    setSearch('')
    setSelectedUserId(null)
  }

  const handleOpen = () => {
    resetState()
    linkUserToOwnerModal.open()
  }

  const users = usersData?.items ?? []

  return (
    <>
      <Button iconId="fr-icon-user-add-line" size="small" onClick={handleOpen}>
        Lier un utilisateur
      </Button>

      <linkUserToOwnerModal.Component title={`Lier un utilisateur à ${ownerName}`} size="large">
        <Input
          label="Rechercher un utilisateur"
          classes={{ root: 'fr-mb-2w' }}
          nativeInputProps={{
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Rechercher parmi les utilisateurs non rattachés...',
          }}
        />

        {debouncedSearch.length >= 2 && (
          <p className="fr-text--xs fr-text-mention--grey fr-mb-2w">
            {users.length} utilisateur{users.length !== 1 ? 's' : ''} disponible{users.length !== 1 ? 's' : ''}
          </p>
        )}

        {debouncedSearch.length >= 2 && (
          <div className={dialogStyles.selectorList}>
            {users.map((u) => {
              const isSelected = selectedUserId === u.id
              const fullName = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.name || u.email
              const initials = getInitials(u.firstname ?? '?', u.lastname ?? '?')
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={isSelected ? dialogStyles.selectorItemSelected : dialogStyles.selectorItem}
                >
                  <div className={dialogStyles.selectorAvatar} style={{ background: getAvatarColor(fullName) }}>
                    {initials}
                  </div>
                  <div className={dialogStyles.selectorInfo}>
                    <div className={dialogStyles.selectorName}>{fullName}</div>
                    <div className={dialogStyles.selectorMeta}>{u.email}</div>
                    {u.createdAt && (
                      <div className={dialogStyles.selectorMetaSmall}>Compte créé le {formatDateTime(new Date(u.createdAt))}</div>
                    )}
                  </div>
                  <div className={isSelected ? dialogStyles.selectorRadioSelected : dialogStyles.selectorRadio} />
                </button>
              )
            })}
            {users.length === 0 && (
              <p className={`fr-text--sm fr-text-mention--grey ${dialogStyles.selectorEmpty}`}>Aucun utilisateur trouvé</p>
            )}
          </div>
        )}

        <div className="fr-flex fr-flex-gap-2v">
          <Button onClick={() => linkMutation.mutate()} disabled={!selectedUserId || linkMutation.isPending}>
            {linkMutation.isPending ? 'En cours...' : "Lier l'utilisateur sélectionné"}
          </Button>
          <Button priority="secondary" onClick={() => linkUserToOwnerModal.close()}>
            Annuler
          </Button>
        </div>
      </linkUserToOwnerModal.Component>
    </>
  )
}
