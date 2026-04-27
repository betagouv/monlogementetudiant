'use client'

import { useTranslations } from 'next-intl'
import { BailleurUserForm, type BailleurUserFormData } from '~/components/bailleur/users/bailleur-user-form'
import { useCreateBailleurUser } from '~/hooks/use-bailleur-users'

type Props = {
  ownerId: number
  canGrantAdministratorRights: boolean
}

export function NewBailleurUserForm({ ownerId, canGrantAdministratorRights }: Props) {
  const create = useCreateBailleurUser()
  const t = useTranslations('bailleur.users')

  const handleSubmit = async (data: BailleurUserFormData) => await create.mutateAsync({ ...data, ownerId })

  return (
    <BailleurUserForm
      onSubmit={handleSubmit}
      isPending={create.isPending}
      submitLabel={t('submitCreate')}
      canGrantAdministratorRights={canGrantAdministratorRights}
    />
  )
}
