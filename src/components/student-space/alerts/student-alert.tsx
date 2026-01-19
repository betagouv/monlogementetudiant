'use client'

import Tag from '@codegouvfr/react-dsfr/Tag'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { DeleteStudentAlert } from '~/components/student-space/alerts/delete-student-alert'
import { StudentAlertCountButton } from '~/components/student-space/alerts/student-alert-count-button'
import { UpdateStudentAlert } from '~/components/student-space/alerts/update-student-alert'
import { TAlert } from '~/schemas/alerts/get-alerts'

type StudentAlertProps = {
  alert: TAlert
}
export const StudentAlert = ({ alert }: StudentAlertProps) => {
  return (
    <div className="fr-border fr-background-default--grey fr-width-full fr-p-5w">
      <div className="fr-flex fr-direction-column fr-flex-gap-4v">
        <div className="fr-flex fr-justify-content-space-between">
          <span className="fr-h4 fr-text-title--blue-france fr-mb-0">{alert.name}</span>
          <div className="fr-flex fr-flex-gap-2v">
            <UpdateStudentAlert alert={alert} />
            <DeleteStudentAlert alertId={alert.id} />
          </div>
        </div>
        <div className="fr-flex fr-flex-gap-2v">
          {alert.city && <Tag small>{`${alert.city?.name} ${alert.department?.code ? `(${alert.department.code})` : ''}`}</Tag>}
          <Tag small>{`${alert.max_price}€ max.`}</Tag>
          {alert.has_coliving && <Tag small>Colocation</Tag>}
          {alert.is_accessible && <Tag small>Accessible</Tag>}
        </div>
      </div>
      <div className="fr-mt-4w fr-flex fr-justify-content-space-between">
        <div className="fr-col-6">
          <ToggleSwitch label="E-mail" inputTitle="terms" defaultChecked={false} showCheckedHint={false} />
        </div>
        <div>
          <StudentAlertCountButton alert={alert} />
        </div>
      </div>
    </div>
  )
}
