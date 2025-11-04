'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { Controller, useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceDetails = () => {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<TUpdateResidence>()
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
          nativeInputProps={register('name')}
          state={errors.name ? 'error' : 'default'}
          stateRelatedMessage={errors.name?.message}
        />

        <div className="fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>Le bailleur accepte les listes d'attente</span>
          <Controller
            name="accept_waiting_list"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                inputTitle="accept_waiting_list"
                label=""
                showCheckedHint={false}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        {/* <div className="fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>Des logements PMR sont disponibles dans la résidence</span>
          <ToggleSwitch 
            inputTitle="pmr_available" 
            label="" 
            showCheckedHint={false}
          />
        </div> */}
      </div>
    </div>
  )
}
