'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Tabs from '@codegouvfr/react-dsfr/Tabs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { inferRouterOutputs } from '@trpc/server'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { type FieldErrors, useForm } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'
import {
  type TContactReceptionSettingsForm,
  type TReceptionManager,
  zContactReceptionSettingsForm,
} from '~/schemas/contacts/contact-reception-settings'
import { useTRPC } from '~/server/trpc/client'
import type { AppRouter } from '~/server/trpc/router'
import styles from './contact-reception-settings-form.module.css'
import { ResidenceReceptionTab } from './residence-reception-tab'

type Settings = inferRouterOutputs<AppRouter>['bailleur']['getContactReceptionSettings']

const tabId = (accommodationId: number) => `residence-${accommodationId}`

export const ContactReceptionSettingsForm = ({ ownerId }: { ownerId: number }) => {
  const t = useTranslations('bailleur.contacts.receptionSettings')
  const trpc = useTRPC()
  const { data } = useQuery(trpc.bailleur.getContactReceptionSettings.queryOptions({ ownerId }))

  if (!data) return null
  if (data.residences.length === 0) return <p className="fr-text-mention--grey fr-mb-0">{t('noResidence')}</p>

  return <ReceptionSettingsFields ownerId={ownerId} settings={data} />
}

const ReceptionSettingsFields = ({ ownerId, settings }: { ownerId: number; settings: Settings }) => {
  const t = useTranslations('bailleur.contacts.receptionSettings')
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<TContactReceptionSettingsForm>({
    resolver: zodResolver(zContactReceptionSettingsForm({ requireManagers: settings.hasGestionnaires })),
    defaultValues: {
      residences: settings.residences
        .filter((r) => r.acceptsApplications)
        .map((r) => ({ accommodationId: r.id, managers: r.managers, acceptWaitingList: r.acceptWaitingList })),
    },
  })

  const selected = watch('residences')
  const [selectedTabId, setSelectedTabId] = useState(selected[0] ? tabId(selected[0].accommodationId) : '')

  const { mutate, isPending } = useMutation(
    trpc.bailleur.saveContactReceptionSettings.mutationOptions({
      onSuccess: async () => {
        createToast({ priority: 'success', message: t('success') })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.getContactReceptionSettings.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.listResidencesWithContactCounts.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.users.list.queryKey() }),
        ])
      },
      onError: (error) => {
        createToast({ priority: 'error', message: error.data?.code === 'BAD_REQUEST' ? error.message : t('error') })
      },
    }),
  )

  const setResidences = (next: TContactReceptionSettingsForm['residences']) =>
    setValue('residences', next, { shouldValidate: isSubmitted, shouldDirty: true })

  const toggleResidence = (residence: Settings['residences'][number], checked: boolean) => {
    if (!checked) {
      setResidences(selected.filter((r) => r.accommodationId !== residence.id))
      return
    }
    const entry = { accommodationId: residence.id, managers: residence.managers, acceptWaitingList: residence.acceptWaitingList }
    const order = settings.residences.map((r) => r.id)
    setResidences([...selected, entry].sort((a, b) => order.indexOf(a.accommodationId) - order.indexOf(b.accommodationId)))
    setSelectedTabId(tabId(residence.id))
  }

  const updateResidence = (index: number, patch: { managers?: TReceptionManager[]; acceptWaitingList?: boolean }) =>
    setResidences(selected.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const onSubmit = (values: TContactReceptionSettingsForm) =>
    mutate({
      ownerId,
      residences: values.residences.map((r) => ({
        accommodationId: r.accommodationId,
        managerIds: r.managers.map((m) => m.id),
        acceptWaitingList: r.acceptWaitingList,
      })),
    })

  const onInvalid = (formErrors: FieldErrors<TContactReceptionSettingsForm>) => {
    const firstInvalid = selected.findIndex((_, index) => formErrors.residences?.[index])
    if (firstInvalid >= 0) setSelectedTabId(tabId(selected[firstInvalid].accommodationId))
  }

  const residenceById = new Map(settings.residences.map((r) => [r.id, r]))
  const activeTabId = selected.some((r) => tabId(r.accommodationId) === selectedTabId)
    ? selectedTabId
    : selected[0] && tabId(selected[0].accommodationId)
  const residencesError = errors.residences?.message ?? errors.residences?.root?.message

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <Checkbox
        legend={t('residencesLegend')}
        state={residencesError ? 'error' : 'default'}
        stateRelatedMessage={residencesError}
        classes={{ content: styles.residences }}
        options={settings.residences.map((residence) => ({
          label: residence.name,
          hintText:
            residence.cityName && residence.departmentCode
              ? t('residenceLocation', { city: residence.cityName, department: residence.departmentCode })
              : (residence.cityName ?? undefined),
          nativeInputProps: {
            name: 'residences',
            value: residence.id,
            checked: selected.some((r) => r.accommodationId === residence.id),
            onChange: (event) => toggleResidence(residence, event.target.checked),
          },
        }))}
      />

      {selected.length > 0 && activeTabId && (
        <Tabs
          className="fr-mt-4w"
          label={t('tabsLabel')}
          selectedTabId={activeTabId}
          onTabChange={setSelectedTabId}
          tabs={selected.map((r) => ({ tabId: tabId(r.accommodationId), label: residenceById.get(r.accommodationId)?.name ?? '' }))}
        >
          {selected.map((r, index) => (
            <div key={r.accommodationId} className={tabId(r.accommodationId) === activeTabId ? undefined : 'fr-hidden'}>
              <ResidenceReceptionTab
                accommodationId={r.accommodationId}
                ownerId={ownerId}
                hasGestionnaires={settings.hasGestionnaires}
                managers={r.managers}
                onManagersChange={(managers) => updateResidence(index, { managers })}
                managersError={errors.residences?.[index]?.managers?.message}
                acceptWaitingList={r.acceptWaitingList}
                onAcceptWaitingListChange={(acceptWaitingList) => updateResidence(index, { acceptWaitingList })}
              />
            </div>
          ))}
        </Tabs>
      )}

      <div className="fr-flex fr-justify-content-end fr-mt-4w">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )
}
