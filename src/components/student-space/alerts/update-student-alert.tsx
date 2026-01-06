'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Range from '@codegouvfr/react-dsfr/Range'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useEffect } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { StudentAlertLocation } from '~/components/student-space/alerts/student-alert-location'
import { useUpdateAlert } from '~/hooks/use-update-alert'
import { TAlert } from '~/schemas/alerts/get-alerts'
import { TUpdateAlertRequest, ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import styles from './student-alerts.module.css'

export const UpdateStudentAlert = ({ alert }: { alert: TAlert }) => {
  const updateStudentAlertModal = createModal({
    id: `update-alert-modal-${alert.id}`,
    isOpenedByDefault: false,
  })

  const { mutateAsync: updateAlert, isLoading } = useUpdateAlert()

  const form = useForm<TUpdateAlertRequest>({
    resolver: zodResolver(ZUpdateAlertRequest),
    defaultValues: {
      name: alert.name,
      max_price: alert.max_price,
      has_coliving: alert.has_coliving,
      is_accessible: alert.is_accessible,
      id: alert.id,
      receive_notifications: alert.receive_notifications,
      city_id: alert.city?.id,
      department_id: alert.department?.id,
      academy_id: alert.academy?.id,
    },
  })

  useEffect(() => {
    form.reset({
      name: alert.name,
      max_price: alert.max_price,
      has_coliving: alert.has_coliving,
      is_accessible: alert.is_accessible,
      id: alert.id,
      receive_notifications: alert.receive_notifications,
      city_id: alert.city?.id,
      department_id: alert.department?.id,
      academy_id: alert.academy?.id,
    })
  }, [alert, form])

  const handleCancel = () => {
    form.reset({
      name: alert.name,
      max_price: alert.max_price,
      has_coliving: alert.has_coliving,
      is_accessible: alert.is_accessible,
      id: alert.id,
      receive_notifications: alert.receive_notifications,
      city_id: alert.city?.id,
      department_id: alert.department?.id,
      academy_id: alert.academy?.id,
    })
    updateStudentAlertModal.close()
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await updateAlert(data)
      updateStudentAlertModal.close()
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  })

  const { control } = form
  return (
    <>
      <Button size="small" iconId="ri-edit-line" priority="tertiary" title="Editer" {...updateStudentAlertModal.buttonProps} />

      <updateStudentAlertModal.Component
        title={
          <>
            <span className={clsx(styles.icon, 'ri-mail-unread-line')} />
            <span className="fr-text--bold"> Édition de l'alerte logements</span>
          </>
        }
      >
        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="fr-flex fr-direction-column fr-flex-gap-4v">
            <span>
              Configurez votre alerte personnalisée et soyez notifié dès qu'un logement correspondant à vos critères est disponible.
            </span>
            <Input
              label="Nom de l'alerte"
              iconId="ri-notification-line"
              state={form.formState.errors.name ? 'error' : 'default'}
              stateRelatedMessage={form.formState.errors.name?.message}
              nativeInputProps={{
                ...form.register('name'),
              }}
            />
            <StudentAlertLocation
              error={form.formState.errors.city_id?.message || form.formState.errors.department_id?.message}
              initialLocation={alert.city?.name || alert.department?.name || alert.academy?.name}
            />

            <Controller
              name="max_price"
              control={control}
              render={({ field }) => (
                <Range
                  label="Budget maximum"
                  max={1000}
                  min={150}
                  hideMinMax
                  step={50}
                  suffix=" €"
                  nativeInputProps={{
                    value: field.value,
                    onChange: (e) => field.onChange(Number(e.target.value)),
                  }}
                />
              )}
            />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-space-between">
              <Controller
                name="has_coliving"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    classes={{ label: 'fr-width-full' }}
                    inputTitle="colocation"
                    showCheckedHint={false}
                    label="En colocation"
                    labelPosition="right"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="is_accessible"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    classes={{ label: 'fr-width-full' }}
                    inputTitle="accessibility"
                    showCheckedHint={false}
                    label="Adapté PMR"
                    labelPosition="right"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="fr-flex fr-justify-content-end fr-flex-gap-2v">
              <Button priority="secondary" type="button" onClick={handleCancel}>
                Annuler
              </Button>
              <Button priority="primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </updateStudentAlertModal.Component>
    </>
  )
}
