'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Range from '@codegouvfr/react-dsfr/Range'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { StudentAlertLocation } from '~/components/student-space/alerts/student-alert-location'
import { ToggleSwitch } from '~/components/ui/toggle-switch'
import { useUpdateAlert } from '~/hooks/use-update-alert'
import { trackEvent } from '~/lib/tracking'
import { TAlert } from '~/schemas/alerts/get-alerts'
import { createZUpdateAlertRequest, TUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import styles from './student-alerts.module.css'

export const UpdateStudentAlert = ({ alert }: { alert: TAlert }) => {
  const t = useTranslations('student.alerts')
  const tSchemas = useTranslations('schemas')
  const schema = useMemo(() => createZUpdateAlertRequest(tSchemas), [tSchemas])
  const updateStudentAlertModal = createModal({
    id: `update-alert-modal-${alert.id}`,
    isOpenedByDefault: false,
  })

  const { mutateAsync: updateAlert, isLoading } = useUpdateAlert()

  const form = useForm<TUpdateAlertRequest>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: alert.name,
      maxPrice: alert.maxPrice,
      hasColiving: alert.hasColiving,
      isAccessible: alert.isAccessible,
      id: alert.id,
      receiveNotifications: alert.receiveNotifications,
      cityId: alert.city?.id,
      departmentId: alert.department?.id,
      academyId: alert.academy?.id,
    },
  })

  useEffect(() => {
    form.reset({
      name: alert.name,
      maxPrice: alert.maxPrice,
      hasColiving: alert.hasColiving,
      isAccessible: alert.isAccessible,
      id: alert.id,
      receiveNotifications: alert.receiveNotifications,
      cityId: alert.city?.id,
      departmentId: alert.department?.id,
      academyId: alert.academy?.id,
    })
  }, [alert, form])

  const handleCancel = () => {
    form.reset({
      name: alert.name,
      maxPrice: alert.maxPrice,
      hasColiving: alert.hasColiving,
      isAccessible: alert.isAccessible,
      id: alert.id,
      receiveNotifications: alert.receiveNotifications,
      cityId: alert.city?.id,
      departmentId: alert.department?.id,
      academyId: alert.academy?.id,
    })
    updateStudentAlertModal.close()
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await updateAlert(data)
      trackEvent({ category: 'Alertes', action: 'modification alerte', name: String(data.id), value: data.maxPrice })
      updateStudentAlertModal.close()
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  })

  const { control } = form
  return (
    <>
      <Button size="small" iconId="ri-edit-line" priority="tertiary" title={t('edit')} {...updateStudentAlertModal.buttonProps} />

      <updateStudentAlertModal.Component
        title={
          <>
            <span className={clsx(styles.icon, 'ri-mail-unread-line')} />
            <span className="fr-text--bold"> {t('editModalTitle')}</span>
          </>
        }
      >
        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="fr-flex fr-direction-column fr-flex-gap-4v">
            <span>{t('modalDescription')}</span>
            <Input
              label={t('nameLabel')}
              iconId="ri-notification-line"
              state={form.formState.errors.name ? 'error' : 'default'}
              stateRelatedMessage={form.formState.errors.name?.message}
              nativeInputProps={{
                ...form.register('name'),
              }}
            />
            <StudentAlertLocation
              error={form.formState.errors.cityId?.message || form.formState.errors.departmentId?.message}
              initialLocation={alert.city?.name || alert.department?.name || alert.academy?.name}
            />

            <Controller
              name="maxPrice"
              control={control}
              render={({ field }) => (
                <Range
                  label={t('maxPriceLabel')}
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
                name="hasColiving"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    classes={{ label: 'fr-width-full' }}
                    inputTitle="colocation"
                    description={t('colivingDescription')}
                    showCheckedHint={false}
                    label={t('colivingLabel')}
                    labelPosition="right"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="isAccessible"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    classes={{ label: 'fr-width-full' }}
                    inputTitle="accessibility"
                    description={t('accessibleDescription')}
                    showCheckedHint={false}
                    label={t('accessibleLabel')}
                    labelPosition="right"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="fr-flex fr-justify-content-end fr-flex-gap-2v">
              <Button priority="secondary" type="button" onClick={handleCancel}>
                {t('cancel')}
              </Button>
              <Button priority="primary" type="submit" disabled={isLoading}>
                {isLoading ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </FormProvider>
      </updateStudentAlertModal.Component>
    </>
  )
}
