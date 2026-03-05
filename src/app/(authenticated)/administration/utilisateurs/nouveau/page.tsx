'use client'

import { UserForm, UserFormData } from '~/components/administration/user-form'
import { useAdminCreateUser } from '~/hooks/use-admin-create-user'

export default function NewUserPage() {
  const createUser = useAdminCreateUser()

  const handleSubmit = (data: UserFormData) => {
    createUser.mutate(data)
  }

  return (
    <>
      <h1 className="fr-h3 fr-mb-3w">Nouvel utilisateur</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <UserForm onSubmit={handleSubmit} isPending={createUser.isPending} submitLabel="Creer l'utilisateur" />
      </div>
    </>
  )
}
