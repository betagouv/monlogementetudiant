'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { LinkUserOwnerDialog } from '~/components/administration/link-user-owner-dialog'
import { RoleBadge } from '~/components/administration/role-badge'
import { UserForm, UserFormData } from '~/components/administration/user-form'
import { createToast } from '~/components/ui/createToast'
import { useAdminDeleteUser } from '~/hooks/use-admin-delete-user'
import { useAdminUpdateUser } from '~/hooks/use-admin-update-user'
import { useAdminUser } from '~/hooks/use-admin-user'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const deleteUserModal = createModal({
  id: 'delete-user-modal',
  isOpenedByDefault: false,
})

export function UserDetail({ id }: { id: string }) {
  const { data: userData, isLoading } = useAdminUser(id)
  const updateUser = useAdminUpdateUser()
  const deleteUser = useAdminDeleteUser()

  if (isLoading) return <p>Chargement...</p>
  if (!userData) return <p>Utilisateur non trouvé</p>

  const handleSubmit = (data: UserFormData) => {
    updateUser.mutate({ id, ...data })
  }

  const handleDelete = () => {
    deleteUser.mutate(id)
  }

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <h1 className="fr-h3 fr-mb-0">
            {userData.firstname} {userData.lastname}
          </h1>
          <RoleBadge role={userData.role} />
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-md-8">
          <div className="fr-card fr-card--no-border fr-p-3w">
            <h2 className="fr-h5 fr-mb-2w">Informations</h2>
            <UserForm
              defaultValues={{
                email: userData.email,
                firstname: userData.firstname,
                lastname: userData.lastname,
                role: userData.role as 'admin' | 'owner' | 'user',
              }}
              onSubmit={handleSubmit}
              isPending={updateUser.isPending}
              submitLabel="Mettre à jour"
            />
          </div>
        </div>

        <div className="fr-col-md-4">
          {userData.role === 'owner' && (
            <div className="fr-card fr-card--no-border fr-p-3w fr-mb-3w">
              <h2 className="fr-h5 fr-mb-2w">Gestionnaire associé</h2>
              {userData.owner ? (
                <div className="fr-mb-2w">
                  <p className="fr-text--bold fr-mb-0">{userData.owner.name}</p>
                  <p className="fr-text--sm fr-text-mention--grey">{userData.owner.slug}</p>
                  <Button priority="tertiary" size="small" linkProps={{ href: `/administration/bailleurs/${userData.owner.id}` }}>
                    Voir le gestionnaire
                  </Button>
                </div>
              ) : (
                <p className="fr-text--sm fr-text-mention--grey fr-mb-2w">Aucun gestionnaire associé</p>
              )}
              <LinkUserOwnerDialog userId={id} currentOwnerId={userData.ownerId ?? null} currentOwnerName={userData.owner?.name ?? null} />
            </div>
          )}

          {userData.role === 'admin' && <AdminLinkedOwners userId={id} links={userData.adminOwnerLinks ?? []} />}

          <div className="fr-card fr-card--no-border fr-p-3w">
            <h2 className="fr-h5 fr-mb-2w">Zone de danger</h2>
            <Button priority="tertiary" onClick={() => deleteUserModal.open()} disabled={deleteUser.isPending}>
              {"Supprimer l'utilisateur"}
            </Button>
          </div>
        </div>
      </div>

      <deleteUserModal.Component
        title="Confirmer la suppression"
        buttons={[
          {
            children: 'Annuler',
            doClosesModal: true,
          },
          {
            children: 'Supprimer',
            onClick: handleDelete,
            doClosesModal: true,
          },
        ]}
      >
        Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
      </deleteUserModal.Component>
    </>
  )
}

const linkAdminOwnerModal = createModal({
  id: 'link-admin-owner-from-user-modal',
  isOpenedByDefault: false,
})

function AdminLinkedOwners({ userId, links }: { userId: string; links: Array<{ owner: { id: number; name: string; slug: string } }> }) {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const unlinkMutation = useMutation({
    mutationFn: (ownerId: number) => trpcClient.admin.users.unlinkAdminFromOwner.mutate({ userId, ownerId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.getById.queryKey({ id: userId }) }),
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() }),
      ])
      createToast({ priority: 'success', message: 'Délié du gestionnaire' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la déliaison' })
    },
  })

  return (
    <div className="fr-card fr-card--no-border fr-p-3w fr-mb-3w">
      <h2 className="fr-h5 fr-mb-2w">Bailleurs associés</h2>
      {links.length === 0 ? (
        <p className="fr-text--sm fr-text-mention--grey fr-mb-2w">Aucun bailleur associé</p>
      ) : (
        <div className="fr-mb-2w">
          {links.map(({ owner }) => (
            <div key={owner.id} className="fr-flex fr-align-items-center fr-justify-content-space-between fr-mb-1w">
              <div>
                <p className="fr-text--bold fr-mb-0">{owner.name}</p>
                <p className="fr-text--xs fr-text-mention--grey fr-mb-0">{owner.slug}</p>
              </div>
              <div className="fr-flex fr-flex-gap-1v">
                <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/bailleurs/${owner.id}` }}>
                  Voir
                </Button>
                <Button
                  priority="tertiary no outline"
                  size="small"
                  onClick={() => unlinkMutation.mutate(owner.id)}
                  disabled={unlinkMutation.isPending}
                >
                  Délier
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <LinkAdminToOwnerFromUserDialog userId={userId} />
    </div>
  )
}

function LinkAdminToOwnerFromUserDialog({ userId }: { userId: string }) {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [debouncedSearch] = useDebounce(search, 300)

  const { data: ownersList } = useQuery({
    ...trpc.admin.owners.list.queryOptions({ page: 1, search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
  })

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOwnerId) return
      await trpcClient.admin.users.linkAdminToOwner.mutate({ userId, ownerId: selectedOwnerId })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.getById.queryKey({ id: userId }) }),
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() }),
      ])
      createToast({ priority: 'success', message: 'Lié au gestionnaire avec succès' })
      linkAdminOwnerModal.close()
      setSearch('')
      setSelectedOwnerId(null)
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la liaison' })
    },
  })

  const handleOpen = () => {
    setSearch('')
    setSelectedOwnerId(null)
    linkAdminOwnerModal.open()
  }

  const owners = ownersList?.items ?? []

  return (
    <>
      <Button priority="secondary" size="small" onClick={handleOpen}>
        Lier à un bailleur
      </Button>

      <linkAdminOwnerModal.Component title="Lier à un bailleur" size="large">
        <Input
          label="Rechercher un gestionnaire"
          classes={{ root: 'fr-mb-2w' }}
          nativeInputProps={{
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Rechercher par nom...',
          }}
        />

        {debouncedSearch.length >= 2 && (
          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '1.5rem' }}>
            {owners.map((o) => {
              const isSelected = selectedOwnerId === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setSelectedOwnerId(o.id)}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{o.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-mention-grey)' }}>{o.slug}</div>
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
            {owners.length === 0 && (
              <p className="fr-text--sm fr-text-mention--grey" style={{ padding: '1rem' }}>
                Aucun gestionnaire trouvé
              </p>
            )}
          </div>
        )}

        <div className="fr-flex fr-flex-gap-2v">
          <Button onClick={() => linkMutation.mutate()} disabled={!selectedOwnerId || linkMutation.isPending}>
            {linkMutation.isPending ? 'En cours...' : 'Lier au gestionnaire sélectionné'}
          </Button>
          <Button priority="secondary" onClick={() => linkAdminOwnerModal.close()}>
            Annuler
          </Button>
        </div>
      </linkAdminOwnerModal.Component>
    </>
  )
}
