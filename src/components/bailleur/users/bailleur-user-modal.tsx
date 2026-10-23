'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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

type PendingOpening = { data: BailleurUserFormData; closed: Array<{ id: number; name: string; cityName: string | null }> }

export const BailleurUserModal = ({ ownerId, ownerContactMode, canGrantAdministratorRights, user, administratorCount }: Props) => {
  const t = useTranslations('bailleur.users')
  const trpc = useTRPC()
  const create = useCreateBailleurUser()
  const update = useUpdateBailleurUser()
  const [limitError, setLimitError] = useState(false)
  const [pendingOpening, setPendingOpening] = useState<PendingOpening | null>(null)
  const isOpen = useIsModalOpen(bailleurUserModal)

  useEffect(() => {
    if (!isOpen) setPendingOpening(null)
  }, [isOpen])

  const isEditing = user !== null

  const { data: detail } = useQuery({
    ...trpc.bailleur.users.getById.queryOptions({ id: user?.id ?? '', ownerId }),
    enabled: isEditing,
  })
  const { data: residences } = useQuery(trpc.bailleur.listOwnerResidences.queryOptions({ ownerId }))
  const scopeDefault: TBailleurAccommodationScope = detail
    ? detail.applicationScope.mode === 'restricted'
      ? { mode: 'restricted', accommodationIds: detail.applicationScope.accommodations.map((a) => a.id) }
      : { mode: 'all' }
    : { mode: 'all' }
  // useForm ne lit ses valeurs par défaut qu'au montage : monté avant le périmètre, le formulaire
  // afficherait « Toutes les résidences » et l'enregistrement écraserait le périmètre restreint.
  const isLoadingDetail = isEditing && !detail
  const isSaving = create.isPending || update.isPending
  const isPending = isSaving || isLoadingDetail

  const otherAdministratorCount = administratorCount - (user?.bailleurRole === 'administrator' ? 1 : 0)
  const limitReached = otherAdministratorCount >= MAX_BAILLEUR_ADMINISTRATORS

  const save = async (data: BailleurUserFormData, openClosedResidences = false) => {
    if (isEditing) await update.mutateAsync({ id: user.id, ownerId, ...data, openClosedResidences })
    else await create.mutateAsync({ ...data, ownerId, openClosedResidences })

    setPendingOpening(null)
    bailleurUserModal.close()
  }

  const closedResidencesIn = (data: BailleurUserFormData) => {
    const scope = data.applicationScope
    if (data.bailleurRole !== 'gestionnaire' || !data.bailleurPermissions.includes('manage_applications')) return []
    if (scope?.mode !== 'restricted') return []
    return (residences?.items ?? []).filter((r) => r.acceptsApplications === false && scope.accommodationIds.includes(r.id))
  }

  const handleSubmit = async (data: BailleurUserFormData) => {
    if (data.bailleurRole === 'administrator' && user?.bailleurRole !== 'administrator' && limitReached) {
      setLimitError(true)
      return
    }
    setLimitError(false)

    const closed = closedResidencesIn(data)
    if (closed.length > 0) {
      setPendingOpening({ data, closed: closed.map(({ id, name, cityName }) => ({ id, name, cityName })) })
      return
    }
    await save(data)
  }

  const withoutClosed = ({ data, closed }: PendingOpening): BailleurUserFormData => {
    const scope = data.applicationScope
    if (scope?.mode !== 'restricted') return data
    const closedIds = new Set(closed.map((r) => r.id))
    return {
      ...data,
      applicationScope: { mode: 'restricted', accommodationIds: scope.accommodationIds.filter((id) => !closedIds.has(id)) },
    }
  }

  const title = isEditing ? `${user.firstname} ${user.lastname}`.trim() || user.email : t('newUser')

  return (
    <bailleurUserModal.Component
      title={pendingOpening ? t('scope.confirmOpenTitle') : title}
      iconId={pendingOpening ? 'fr-icon-warning-line' : 'ri-user-line'}
      size="large"
      buttons={
        pendingOpening
          ? [
              {
                children: t('scope.confirmOpenBack'),
                priority: 'tertiary',
                disabled: isSaving,
                doClosesModal: false,
                onClick: () => setPendingOpening(null),
              },
              {
                children: t('scope.confirmOpenRemove', { count: pendingOpening.closed.length }),
                priority: 'secondary',
                disabled: isSaving,
                doClosesModal: false,
                onClick: () => save(withoutClosed(pendingOpening)),
              },
              {
                children: isSaving ? t('saving') : t('scope.confirmOpenSubmit'),
                priority: 'primary',
                disabled: isSaving,
                doClosesModal: false,
                onClick: () => save(pendingOpening.data, true),
              },
            ]
          : [
              { children: t('cancel'), priority: 'secondary', disabled: isPending, doClosesModal: true },
              {
                children: isSaving ? t('saving') : t('submit'),
                priority: 'primary',
                disabled: isPending,
                nativeButtonProps: { type: 'submit', form: FORM_ID },
                doClosesModal: false,
              },
            ]
      }
    >
      {pendingOpening && (
        <>
          <p>{t('scope.confirmOpenIntro', { count: pendingOpening.closed.length })}</p>
          <ul>
            {pendingOpening.closed.map((residence) => (
              <li key={residence.id}>{residence.cityName ? `${residence.name} — ${residence.cityName}` : residence.name}</li>
            ))}
          </ul>
        </>
      )}

      {limitError && (
        <Alert className="fr-mb-2w" severity="warning" small description={t('adminLimit.body', { max: MAX_BAILLEUR_ADMINISTRATORS })} />
      )}

      {isLoadingDetail ? (
        <p className="fr-text-mention--grey">{t('loading')}</p>
      ) : (
        // Masqué et non démonté pendant la confirmation : « Retour » retrouve la saisie intacte.
        <div className={pendingOpening ? 'fr-hidden' : undefined}>
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
        </div>
      )}
    </bailleurUserModal.Component>
  )
}
