'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Range from '@codegouvfr/react-dsfr/Range'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { FormProvider, useForm } from 'react-hook-form'
import { StudentAlertLocation } from '~/components/student-space/alerts/student-alert-location'
import { useCreateAlert } from '~/hooks/use-create-alert'
import { type TCreateAlertRequest, ZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import styles from './student-alerts.module.css'

export const createStudentAlertModal = createModal({
  id: 'create-alert-modal',
  isOpenedByDefault: false,
})

export const CreateStudentAlert = () => {
  const { mutateAsync: createAlert, isLoading } = useCreateAlert()

  const form = useForm<TCreateAlertRequest>({
    resolver: zodResolver(ZCreateAlertRequest),
    defaultValues: {
      name: '',
      max_price: 1000,
      has_coliving: false,
      is_accessible: false,
    },
  })

  const handleCancel = () => {
    form.reset()
    createStudentAlertModal.close()
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await createAlert(data)
      form.reset()
      createStudentAlertModal.close()
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  })

  return (
    <>
      <Button priority="secondary" {...createStudentAlertModal.buttonProps}>
        Créer une nouvelle alerte
      </Button>

      <createStudentAlertModal.Component
        title={
          <>
            <span className={clsx(styles.icon, 'ri-mail-unread-line')} />
            <span className="fr-text--bold"> Nouvelle alerte logements</span>
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
            <StudentAlertLocation error={form.formState.errors.city_id?.message || form.formState.errors.department_id?.message} />

            <Range
              label="Budget maximum"
              max={1000}
              min={150}
              hideMinMax
              step={50}
              suffix=" €"
              nativeInputProps={{
                value: form.watch('max_price'),
                onChange: (e) => form.setValue('max_price', Number(e.target.value)),
              }}
            />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-space-between">
              <ToggleSwitch
                classes={{ label: 'fr-width-full' }}
                inputTitle="colocation"
                showCheckedHint={false}
                label="En colocation"
                labelPosition="right"
                checked={form.watch('has_coliving')}
                onChange={(checked) => form.setValue('has_coliving', checked)}
              />
              <ToggleSwitch
                classes={{ label: 'fr-width-full' }}
                inputTitle="accessibility"
                showCheckedHint={false}
                label="Adapté PMR"
                labelPosition="right"
                checked={form.watch('is_accessible')}
                onChange={(checked) => form.setValue('is_accessible', checked)}
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
      </createStudentAlertModal.Component>
    </>
  )
}
