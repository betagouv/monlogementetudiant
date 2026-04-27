'use client'

import { useTranslations } from 'next-intl'
import { BailleurUserForm, type BailleurUserFormData } from '~/components/bailleur/users/bailleur-user-form'
import { useBailleurUser, useUpdateBailleurUser } from '~/hooks/use-bailleur-users'

type Props = {
  id: string
  ownerId: number
  canGrantAdministratorRights: boolean
}

export function EditBailleurUserForm({ id, ownerId, canGrantAdministratorRights }: Props) {
  const { data, isLoading } = useBailleurUser(id, ownerId)
  const update = useUpdateBailleurUser()
  const t = useTranslations('bailleur.users')

  if (isLoading) return <p>{t('loading')}</p>
  if (!data) return <p>{t('notFound')}</p>

  const handleSubmit = async (formData: BailleurUserFormData) => {
    const { email: _email, ...rest } = formData
    await update.mutateAsync({ id, ownerId, ...rest })
  }

  return (
    <BailleurUserForm
      defaultValues={{
        email: data.email,
        firstname: data.firstname,
        lastname: data.lastname,
        bailleurRole: data.bailleurRole ?? 'gestionnaire',
        bailleurPermissions: data.bailleurPermissions ?? [],
      }}
      onSubmit={handleSubmit}
      isPending={update.isPending}
      submitLabel={t('submitUpdate')}
      emailReadOnly
      canGrantAdministratorRights={canGrantAdministratorRights}
    />
  )
}
