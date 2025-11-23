'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Tag from '@codegouvfr/react-dsfr/Tag'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'

type StudentAlertProps = {
  alert: {
    title: string
    city: string
    price: string
    colocation: boolean
  }
}
export const StudentAlert = ({ alert }: StudentAlertProps) => {
  return (
    <div className="fr-border fr-background-default--grey fr-width-full fr-p-5w">
      <div className="fr-flex fr-direction-column fr-flex-gap-4v">
        <div className="fr-flex fr-justify-content-space-between">
          <span className="fr-h4 fr-text-title--blue-france fr-mb-0">{alert.title}</span>
          <div className="fr-flex fr-flex-gap-2v">
            <Button size="small" iconId="ri-edit-line" priority="tertiary" title="Editer" />
            <Button size="small" iconId="ri-delete-bin-line" priority="tertiary" title="Supprimer" />
          </div>
        </div>
        <div className="fr-flex fr-flex-gap-2v">
          <Tag small>{alert.city}</Tag>
          <Tag small>{alert.price}</Tag>
          <Tag small>{alert.colocation && 'Colocation'}</Tag>
        </div>
      </div>
      <div className="fr-mt-4w fr-flex fr-justify-content-space-between">
        <div className="fr-col-6">
          <ToggleSwitch label="E-mail" inputTitle="terms" defaultChecked={false} showCheckedHint={false} />
        </div>
        <div>
          <Button priority="secondary">
            4 résidences
            <span className="fr-ml-1w ri-arrow-right-line" />
          </Button>
        </div>
      </div>
    </div>
  )
}
