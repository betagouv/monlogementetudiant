'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { LinkUserOwnerDialog } from '~/components/administration/link-user-owner-dialog'
import { RoleBadge } from '~/components/administration/role-badge'
import { UserForm, UserFormData } from '~/components/administration/user-form'
import { useAdminDeleteUser } from '~/hooks/use-admin-delete-user'
import { useAdminUpdateUser } from '~/hooks/use-admin-update-user'
import { useAdminUser } from '~/hooks/use-admin-user'

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
        <Button priority="tertiary" iconId="fr-icon-arrow-left-line" linkProps={{ href: '/administration/utilisateurs' }}>
          Retour
        </Button>
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
            <LinkUserOwnerDialog userId={id} currentOwnerId={userData.ownerId ?? null} />
          </div>

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
