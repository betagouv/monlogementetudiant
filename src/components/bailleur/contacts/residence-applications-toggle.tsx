'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

const suspendApplicationsModal = createModal({
  id: 'suspend-applications-modal',
  isOpenedByDefault: false,
})

interface Props {
  slug: string
}

export const ResidenceApplicationsToggle = ({ slug }: Props) => {
  const t = useTranslations('bailleur.contacts.applicationsToggle')
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data } = useQuery(trpc.bailleur.listContactsByResidence.queryOptions({ slug }))
  const suspended = data?.residence.applicationsSuspended ?? false

  const { mutate, isPending } = useMutation(
    trpc.bailleur.setApplicationsSuspended.mutationOptions({
      onSuccess: async ({ suspended }) => {
        suspendApplicationsModal.close()
        createToast({ priority: 'success', message: suspended ? t('suspendedSuccess') : t('resumedSuccess') })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.listContactsByResidence.queryKey({ slug }) }),
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.listResidencesWithContactCounts.queryKey() }),
        ])
      },
      onError: () => {
        createToast({ priority: 'error', message: t('error') })
      },
    }),
  )

  const onChange = (checked: boolean) => {
    if (checked) {
      mutate({ slug, suspended: false })
      return
    }
    suspendApplicationsModal.open()
  }

  return (
    <>
      <ToggleSwitch
        label={t('label')}
        helperText={suspended ? t('suspendedHint') : t('openHint')}
        inputTitle={t('label')}
        checked={!suspended}
        disabled={isPending || !data}
        showCheckedHint={false}
        labelPosition="left"
        onChange={onChange}
      />

      <suspendApplicationsModal.Component
        title={t('modalTitle')}
        buttons={[
          { children: t('cancel'), priority: 'secondary', disabled: isPending },
          {
            children: t('confirm'),
            priority: 'primary',
            disabled: isPending,
            doClosesModal: false,
            onClick: () => mutate({ slug, suspended: true }),
          },
        ]}
      >
        <p>{t('modalDescription')}</p>
      </suspendApplicationsModal.Component>
    </>
  )
}
