'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import { useDeleteAlert } from '~/hooks/use-delete-alert'
import { trackEvent } from '~/lib/tracking'
import { TDeleteAlert, ZDeleteAlert } from '~/schemas/alerts/delete-alert'
import styles from './student-alerts.module.css'

export const DeleteStudentAlert = ({ alertId }: { alertId: number }) => {
  const { mutateAsync: deleteAlert, isLoading } = useDeleteAlert()

  const deleteStudentAlertModal = createModal({
    id: `delete-alert-modal-${alertId}`,
    isOpenedByDefault: false,
  })

  const form = useForm<TDeleteAlert>({
    resolver: zodResolver(ZDeleteAlert),
    defaultValues: {
      id: alertId,
    },
  })
  const handleSubmit = form.handleSubmit(async () => {
    try {
      await deleteAlert(form.getValues())
      trackEvent({ category: 'Alertes', action: 'suppression alerte', name: String(alertId) })
      form.reset()
      deleteStudentAlertModal.close()
    } catch (error) {
      console.error('Error deleting alert:', error)
    }
  })

  const handleCancel = () => {
    form.reset()
    deleteStudentAlertModal.close()
  }

  return (
    <>
      <Button
        size="small"
        iconId="ri-delete-bin-line"
        priority="tertiary"
        title="Supprimer l'alerte"
        {...deleteStudentAlertModal.buttonProps}
      />

      <deleteStudentAlertModal.Component
        title={
          <>
            <span className={clsx(styles.icon, 'ri-delete-bin-line')} />
            <span className="fr-text--bold"> Suppression de l'alerte logements</span>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="fr-flex fr-direction-column fr-flex-gap-4v">
          Confirmez la suppression de cette alerte
          <div className="fr-flex fr-justify-content-end fr-flex-gap-2v">
            <Button priority="secondary" type="button" onClick={handleCancel}>
              Annuler
            </Button>
            <Button priority="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </deleteStudentAlertModal.Component>
    </>
  )
}
