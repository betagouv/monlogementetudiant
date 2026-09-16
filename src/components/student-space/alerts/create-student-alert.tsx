'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Range from '@codegouvfr/react-dsfr/Range'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { StudentAlertLocation } from '~/components/student-space/alerts/student-alert-location'
import { ToggleSwitch } from '~/components/ui/toggle-switch'
import { useCreateAlert } from '~/hooks/use-create-alert'
import { trackEvent } from '~/lib/tracking'
import { createZCreateAlertRequest, type TCreateAlertRequest } from '~/schemas/alerts/create-alert'
import styles from './student-alerts.module.css'

export const createStudentAlertModal = createModal({
  id: 'create-alert-modal',
  isOpenedByDefault: false,
})

export const CreateStudentAlert = () => {
  const t = useTranslations('student.alerts')
  const tSchemas = useTranslations('schemas')
  const schema = useMemo(() => createZCreateAlertRequest(tSchemas), [tSchemas])
  const { mutateAsync: createAlert, isLoading } = useCreateAlert()

  const form = useForm<TCreateAlertRequest>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      maxPrice: 1000,
      hasColiving: false,
      isAccessible: false,
    },
  })

  const handleCancel = () => {
    form.reset()
    createStudentAlertModal.close()
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await createAlert(data)
      trackEvent({ category: 'Alertes', action: 'creation alerte', name: data.name, value: data.maxPrice })
      form.reset()
      createStudentAlertModal.close()
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  })

  return (
    <>
      <Button priority="secondary" {...createStudentAlertModal.buttonProps}>
        {t('create')}
      </Button>

      <createStudentAlertModal.Component
        title={
          <>
            <span className={clsx(styles.icon, 'ri-mail-unread-line')} />
            <span className="fr-text--bold"> {t('createModalTitle')}</span>
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
            <StudentAlertLocation error={form.formState.errors.cityId?.message || form.formState.errors.departmentId?.message} />

            <Range
              label={t('maxPriceLabel')}
              max={1000}
              min={150}
              hideMinMax
              step={50}
              suffix=" €"
              nativeInputProps={{
                value: form.watch('maxPrice'),
                onChange: (e) => form.setValue('maxPrice', Number(e.target.value)),
              }}
            />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-space-between">
              <ToggleSwitch
                classes={{ label: 'fr-width-full' }}
                inputTitle="colocation"
                description={t('colivingDescription')}
                showCheckedHint={false}
                label={t('colivingLabel')}
                labelPosition="right"
                checked={form.watch('hasColiving')}
                onChange={(checked) => form.setValue('hasColiving', checked)}
              />
              <ToggleSwitch
                classes={{ label: 'fr-width-full' }}
                inputTitle="accessibility"
                description={t('accessibleDescription')}
                showCheckedHint={false}
                label={t('accessibleLabel')}
                labelPosition="right"
                checked={form.watch('isAccessible')}
                onChange={(checked) => form.setValue('isAccessible', checked)}
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
      </createStudentAlertModal.Component>
    </>
  )
}
