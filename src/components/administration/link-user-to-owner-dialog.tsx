'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { formatDateTime } from '~/utils/formatDate'

const linkUserToOwnerModal = createModal({
  id: 'link-user-to-owner-modal',
  isOpenedByDefault: false,
})

interface LinkUserToOwnerDialogProps {
  ownerId: number
  ownerName: string
}

const AVATAR_COLORS = ['#000091', '#6A6AF4', '#009081', '#E4794A', '#CE614A', '#A558A0', '#C3992A', '#417DC4']

function getColorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(firstname: string, lastname: string) {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase()
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
          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '1.5rem' }}>
            {users.map((u) => {
              const isSelected = selectedUserId === u.id
              const fullName = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.name || u.email
              const initials = getInitials(u.firstname ?? '?', u.lastname ?? '?')
              const color = getColorForName(fullName)
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: isSelected ? '2px solid var(--border-action-high-blue-france)' : '1px solid var(--border-default-grey)',
                    borderRadius: '0.5rem',
                    background: isSelected ? 'var(--background-action-low-blue-france)' : 'var(--background-default-grey)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      background: color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{fullName}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-mention-grey)' }}>{u.email}</div>
                    {u.createdAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-mention-grey)' }}>
                        Compte créé le {formatDateTime(new Date(u.createdAt))}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '50%',
                      border: isSelected ? '6px solid var(--background-action-high-blue-france)' : '2px solid var(--border-default-grey)',
                      flexShrink: 0,
                    }}
                  />
                </button>
              )
            })}
            {users.length === 0 && (
              <p className="fr-text--sm fr-text-mention--grey" style={{ padding: '1rem' }}>
                Aucun utilisateur trouvé
              </p>
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
