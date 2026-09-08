'use client'

import { useTranslations } from 'next-intl'
import { AdminLimitReachedModal, adminLimitModal } from '~/components/bailleur/users/admin-limit-modal'
import { BailleurUserForm, type BailleurUserFormData } from '~/components/bailleur/users/bailleur-user-form'
import { useBailleurUser, useUpdateBailleurUser } from '~/hooks/use-bailleur-users'
import { MAX_BAILLEUR_ADMINISTRATORS } from '~/server/bailleur/permissions'

type Props = {
  id: string
  ownerId: number
  canGrantAdministratorRights: boolean
  /** Administrateurs du bailleur hors utilisateur edite : editer un administrateur en place ne doit pas buter sur le plafond. */
  otherAdministratorCount: number
}

export function EditBailleurUserForm({ id, ownerId, canGrantAdministratorRights, otherAdministratorCount }: Props) {
  const { data, isLoading } = useBailleurUser(id, ownerId)
  const update = useUpdateBailleurUser()
  const t = useTranslations('bailleur.users')

  if (isLoading) return <p>{t('loading')}</p>
  if (!data) return <p>{t('notFound')}</p>

  const limitReached = otherAdministratorCount >= MAX_BAILLEUR_ADMINISTRATORS

  const handleSubmit = async (formData: BailleurUserFormData) => {
    if (formData.bailleurRole === 'administrator' && data.bailleurRole !== 'administrator' && limitReached) {
      adminLimitModal.open()
      return
    }
    await update.mutateAsync({ id, ownerId, ...formData })
  }

  return (
    <>
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
        canGrantAdministratorRights={canGrantAdministratorRights}
        administratorLimitReached={limitReached && data.bailleurRole !== 'administrator'}
      />
      <AdminLimitReachedModal />
    </>
  )
}
