'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { BailleurUserForm, type BailleurUserFormData } from '~/components/bailleur/users/bailleur-user-form'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useCreateBailleurUser, useUpdateBailleurUser } from '~/hooks/use-bailleur-users'
import type { TBailleurAccommodationScope } from '~/schemas/bailleur-users/accommodation-scope'
import { type BailleurPermission, type BailleurRole, MAX_BAILLEUR_ADMINISTRATORS } from '~/server/bailleur/permissions'
import { useTRPC } from '~/server/trpc/client'

export const bailleurUserModal = createModal({
  id: 'bailleur-user-modal',
  isOpenedByDefault: false,
})

export type EditableBailleurUser = {
  id: string
  email: string
  firstname: string
  lastname: string
  bailleurRole: BailleurRole | null
  bailleurPermissions: BailleurPermission[]
  applicationScopeCount?: number | null
}

type Props = {
  ownerId: number
  ownerContactMode: EOwnerContactMode
  canGrantAdministratorRights: boolean
  user: EditableBailleurUser | null
  administratorCount: number
}

const FORM_ID = 'bailleur-user-form'

export const BailleurUserModal = ({ ownerId, ownerContactMode, canGrantAdministratorRights, user, administratorCount }: Props) => {
  const t = useTranslations('bailleur.users')
  const trpc = useTRPC()
  const create = useCreateBailleurUser()
  const update = useUpdateBailleurUser()
  const [limitError, setLimitError] = useState(false)

  const isPending = create.isPending || update.isPending
  const isEditing = user !== null

  const { data: detail } = useQuery({
    ...trpc.bailleur.users.getById.queryOptions({ id: user?.id ?? '', ownerId }),
    enabled: isEditing,
  })
  const scopeDefault: TBailleurAccommodationScope = detail
    ? detail.applicationScope.mode === 'restricted'
      ? { mode: 'restricted', accommodationIds: detail.applicationScope.accommodations.map((a) => a.id) }
      : { mode: 'all' }
    : { mode: 'all' }

  const otherAdministratorCount = administratorCount - (user?.bailleurRole === 'administrator' ? 1 : 0)
  const limitReached = otherAdministratorCount >= MAX_BAILLEUR_ADMINISTRATORS

  const handleSubmit = async (data: BailleurUserFormData) => {
    if (data.bailleurRole === 'administrator' && user?.bailleurRole !== 'administrator' && limitReached) {
      setLimitError(true)
      return
    }
    setLimitError(false)

    if (isEditing) await update.mutateAsync({ id: user.id, ownerId, ...data })
    else await create.mutateAsync({ ...data, ownerId })

    bailleurUserModal.close()
  }

  const title = isEditing ? `${user.firstname} ${user.lastname}`.trim() || user.email : t('newUser')

  return (
    <bailleurUserModal.Component
      title={title}
      iconId="ri-user-line"
      size="large"
      buttons={[
        { children: t('cancel'), priority: 'secondary', disabled: isPending, doClosesModal: true },
        {
          children: isPending ? t('saving') : t('submit'),
          priority: 'primary',
          disabled: isPending,
          nativeButtonProps: { type: 'submit', form: FORM_ID },
          doClosesModal: false,
        },
      ]}
    >
      {limitError && (
        <Alert className="fr-mb-2w" severity="warning" small description={t('adminLimit.body', { max: MAX_BAILLEUR_ADMINISTRATORS })} />
      )}

      <BailleurUserForm
        ownerId={ownerId}
        formId={FORM_ID}
        key={user?.id ?? 'new'}
        defaultValues={
          user
            ? {
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                bailleurRole: user.bailleurRole ?? 'gestionnaire',
                bailleurPermissions: user.bailleurPermissions ?? [],
                applicationScope: scopeDefault,
              }
            : undefined
        }
        initialScopeSelection={detail?.applicationScope.accommodations}
        onSubmit={handleSubmit}
        canGrantAdministratorRights={canGrantAdministratorRights}
        administratorLimitReached={limitReached && user?.bailleurRole !== 'administrator'}
        ownerContactMode={ownerContactMode}
      />
    </bailleurUserModal.Component>
  )
}
