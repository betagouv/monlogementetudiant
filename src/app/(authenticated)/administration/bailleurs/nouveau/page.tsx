'use client'

import { OwnerForm, OwnerFormData } from '~/components/administration/owner-form'
import { useAdminCreateOwner } from '~/hooks/use-admin-create-owner'

export default function NewOwnerPage() {
  const createOwner = useAdminCreateOwner()

  const handleSubmit = (data: OwnerFormData) => {
    createOwner.mutate({ name: data.name, url: data.url || undefined })
  }

  return (
    <>
      <h1 className="fr-h3 fr-mb-3w">Nouveau bailleur</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <OwnerForm onSubmit={handleSubmit} isPending={createOwner.isPending} submitLabel="Creer le bailleur" />
      </div>
    </>
  )
}
