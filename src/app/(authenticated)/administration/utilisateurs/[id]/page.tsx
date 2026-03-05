'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { LinkUserOwnerDialog } from '~/components/administration/link-user-owner-dialog'
import { RoleBadge } from '~/components/administration/role-badge'
import { UserForm, UserFormData } from '~/components/administration/user-form'
import { useAdminDeleteUser } from '~/hooks/use-admin-delete-user'
import { useAdminUpdateUser } from '~/hooks/use-admin-update-user'
import { useAdminUser } from '~/hooks/use-admin-user'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: userData, isLoading } = useAdminUser(id)
  const updateUser = useAdminUpdateUser()
  const deleteUser = useAdminDeleteUser()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return <p>Chargement...</p>
  if (!userData) return <p>Utilisateur non trouve</p>

  const handleSubmit = (data: UserFormData) => {
    updateUser.mutate({ id, ...data })
  }

  const handleDelete = () => {
    if (confirmDelete) {
      deleteUser.mutate(id)
    } else {
      setConfirmDelete(true)
    }
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
              submitLabel="Mettre a jour"
            />
          </div>
        </div>

        <div className="fr-col-md-4">
          <div className="fr-card fr-card--no-border fr-p-3w fr-mb-3w">
            <h2 className="fr-h5 fr-mb-2w">Bailleur associe</h2>
            {userData.owner ? (
              <div className="fr-mb-2w">
                <p className="fr-text--bold fr-mb-0">{userData.owner.name}</p>
                <p className="fr-text--sm fr-text-mention--grey">{userData.owner.slug}</p>
                <Button priority="tertiary" size="small" linkProps={{ href: `/administration/bailleurs/${userData.owner.id}` }}>
                  Voir le bailleur
                </Button>
              </div>
            ) : (
              <p className="fr-text--sm fr-text-mention--grey fr-mb-2w">Aucun bailleur associe</p>
            )}
            <LinkUserOwnerDialog userId={id} currentOwnerId={userData.ownerId ?? null} />
          </div>

          <div className="fr-card fr-card--no-border fr-p-3w">
            <h2 className="fr-h5 fr-mb-2w">Zone de danger</h2>
            <Button
              priority={confirmDelete ? 'primary' : 'tertiary'}
              onClick={handleDelete}
              disabled={deleteUser.isPending}
              style={confirmDelete ? { backgroundColor: 'var(--background-flat-error)' } : undefined}
            >
              {confirmDelete ? 'Confirmer la suppression' : "Supprimer l'utilisateur"}
            </Button>
            {confirmDelete && (
              <Button priority="tertiary" size="small" className="fr-ml-1w" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
