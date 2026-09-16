'use client'

import Tag from '@codegouvfr/react-dsfr/Tag'
import { useTranslations } from 'next-intl'
import { DeleteStudentAlert } from '~/components/student-space/alerts/delete-student-alert'
import { StudentAlertCountButton } from '~/components/student-space/alerts/student-alert-count-button'
import { UpdateStudentAlert } from '~/components/student-space/alerts/update-student-alert'
import { ToggleSwitch } from '~/components/ui/toggle-switch'
import { useUpdateAlert } from '~/hooks/use-update-alert'
import { TAlert } from '~/schemas/alerts/get-alerts'

type StudentAlertProps = {
  alert: TAlert
}
export const StudentAlert = ({ alert }: StudentAlertProps) => {
  const t = useTranslations('student.alerts')
  const { mutateAsync: updateAlert } = useUpdateAlert()

  const handleToggleNotifications = async (checked: boolean) => {
    await updateAlert({ id: alert.id, receiveNotifications: checked })
  }

  return (
    <div className="fr-border fr-background-default--grey fr-width-full fr-p-5w">
      <div className="fr-flex fr-direction-column fr-flex-gap-4v">
        <div className="fr-flex fr-justify-content-space-between">
          <h2 className="fr-h4 fr-text-title--blue-france fr-mb-0">{alert.name}</h2>
          <div className="fr-flex fr-flex-gap-2v">
            <UpdateStudentAlert alert={alert} />
            <DeleteStudentAlert alertId={alert.id} />
          </div>
        </div>
        <div className="fr-flex fr-flex-gap-2v">
          {alert.city && <Tag small>{`${alert.city?.name} ${alert.department?.code ? `(${alert.department.code})` : ''}`}</Tag>}
          <Tag small>{t('maxPriceTag', { price: alert.maxPrice })}</Tag>
          {alert.hasColiving && <Tag small>{t('colivingTag')}</Tag>}
          {alert.isAccessible && <Tag small>{t('accessibleTag')}</Tag>}
        </div>
      </div>
      <div className="fr-mt-4w fr-flex fr-justify-content-space-between">
        <div className="fr-col-6">
          <ToggleSwitch
            label={t('notificationsLabel')}
            inputTitle={`receive-notifications-${alert.id}`}
            description={t('notificationsDescription', { name: alert.name })}
            checked={alert.receiveNotifications}
            onChange={handleToggleNotifications}
            showCheckedHint={false}
          />
        </div>
        <div>
          <StudentAlertCountButton alert={alert} />
        </div>
      </div>
    </div>
  )
}
