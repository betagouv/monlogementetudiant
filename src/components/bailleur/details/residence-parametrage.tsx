'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { FC } from 'react'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

interface ResidenceDetailsProps {
  accommodation: TAccomodationDetails
}

export const ResidenceDetails: FC<ResidenceDetailsProps> = ({ accommodation }) => {
  return (
    <div className="fr-border-bottom">
      <div className="fr-px-6w fr-py-6w">
        <h3>Paramétrage de la résidence</h3>
        <Input
          label={
            <>
              Nom de la résidence <span className="fr-text-">*</span>
            </>
          }
          nativeInputProps={{ value: accommodation.name }}
        />

        <div className="fr-border-bottom fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>Le bailleur accepte les listes d'attente</span>
          <ToggleSwitch inputTitle="" label="" defaultChecked={true} showCheckedHint={false} />
        </div>
        <div className="fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>Des logements PMR sont disponibles dans la résidence</span>
          <ToggleSwitch inputTitle="" label="" defaultChecked={true} showCheckedHint={false} />
        </div>
      </div>
    </div>
  )
}
