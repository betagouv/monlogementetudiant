'use client'

import { UserForm, UserFormData } from '~/components/administration/user-form'
import { useAdminCreateUser } from '~/hooks/use-admin-create-user'

export default function NewOwnerAccountPage() {
  const createUser = useAdminCreateUser()

  const handleSubmit = (data: UserFormData) => createUser.mutate(data)

  return (
    <>
      <h1 className="fr-h3 fr-mb-3w">Nouveau compte gestionnaire</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <UserForm
          defaultValues={{ role: 'owner' }}
          hideRoleField
          onSubmit={handleSubmit}
          isPending={createUser.isPending}
          submitLabel="Créer le compte gestionnaire"
        />
      </div>
    </>
  )
}
