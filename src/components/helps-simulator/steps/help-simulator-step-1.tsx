'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'

export const HelpSimulatorStep1: FC = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()

  return (
    <>
      <Input
        label={<RequiredLabel>Quel âge avez-vous ?</RequiredLabel>}
        state={errors.age ? 'error' : undefined}
        stateRelatedMessage={errors.age?.message}
        nativeInputProps={{
          ...register('age', { valueAsNumber: true }),
          type: 'number',
          min: 16,
          max: 99,
        }}
      />
      <RadioButtons
        legend={<RequiredLabel>Quel est votre statut ?</RequiredLabel>}
        name="status"
        state={errors.status ? 'error' : undefined}
        stateRelatedMessage={errors.status?.message}
        className="fr-mb-0"
        options={[
          {
            label: 'Étudiant',
            nativeInputProps: {
              ...register('status'),
              value: 'student',
            },
          },
          {
            label: 'Apprenti / Alternant',
            nativeInputProps: {
              ...register('status'),
              value: 'apprentice',
            },
          },
        ]}
      />
    </>
  )
}
