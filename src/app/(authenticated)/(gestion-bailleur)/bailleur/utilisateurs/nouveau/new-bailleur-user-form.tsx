'use client'

import { useTranslations } from 'next-intl'
import { AdminLimitReachedModal, adminLimitModal } from '~/components/bailleur/users/admin-limit-modal'
import { BailleurUserForm, type BailleurUserFormData } from '~/components/bailleur/users/bailleur-user-form'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useCreateBailleurUser } from '~/hooks/use-bailleur-users'
import { MAX_BAILLEUR_ADMINISTRATORS } from '~/server/bailleur/permissions'

type Props = {
  ownerId: number
  canGrantAdministratorRights: boolean
  administratorCount: number
  ownerContactMode: EOwnerContactMode
}

export function NewBailleurUserForm({ ownerId, canGrantAdministratorRights, administratorCount, ownerContactMode }: Props) {
  const create = useCreateBailleurUser()
  const t = useTranslations('bailleur.users')

  const handleSubmit = async (data: BailleurUserFormData) => {
    if (data.bailleurRole === 'administrator' && administratorCount >= MAX_BAILLEUR_ADMINISTRATORS) {
      adminLimitModal.open()
      return
    }
    await create.mutateAsync({ ...data, ownerId })
  }

  return (
    <>
      <BailleurUserForm
        onSubmit={handleSubmit}
        isPending={create.isPending}
        submitLabel={t('submitCreate')}
        canGrantAdministratorRights={canGrantAdministratorRights}
        administratorLimitReached={administratorCount >= MAX_BAILLEUR_ADMINISTRATORS}
        ownerContactMode={ownerContactMode}
      />
      <AdminLimitReachedModal />
    </>
  )
}
