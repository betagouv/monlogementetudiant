'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import { Money } from '@codegouvfr/react-dsfr/picto'
import Backpack from '@codegouvfr/react-dsfr/picto/Backpack'
import Ecosystem from '@codegouvfr/react-dsfr/picto/Ecosystem'
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
        classes={{
          content: 'fr-flex fr-flex-gap-4v fr-align-items-center fr-flex-wrap',
          inputGroup: 'fr-mb-0 fr-mt-0',
        }}
        options={[
          {
            illustration: <Backpack width={56} height={56} />,
            label: 'Étudiant',
            nativeInputProps: {
              ...register('status'),
              value: 'student',
            },
          },
          {
            illustration: <Money width={56} height={56} />,
            label: 'Étudiant salarié',
            nativeInputProps: {
              ...register('status'),
              value: 'employed-student',
            },
          },
          {
            illustration: <Ecosystem width={56} height={56} />,
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
