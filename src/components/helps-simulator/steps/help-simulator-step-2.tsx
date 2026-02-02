'use client'

import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'

export const HelpSimulatorStep2: FC = () => {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<HelpSimulatorFormData>()

  const rentUnknown = watch('rentUnknown')

  return (
    <>
      <Input
        label={<RequiredLabel>Vos revenus mensuels</RequiredLabel>}
        hintText="Salaire en euros"
        state={errors.monthlyIncome ? 'error' : undefined}
        stateRelatedMessage={errors.monthlyIncome?.message}
        nativeInputProps={{
          ...register('monthlyIncome', { valueAsNumber: true }),
          type: 'number',
          min: 0,
        }}
      />
      <Input
        label={rentUnknown ? 'Montant de votre loyer mensuel' : <RequiredLabel>Montant de votre loyer mensuel</RequiredLabel>}
        hintText="Charges comprises, en euros"
        disabled={rentUnknown === true}
        state={errors.monthlyRent ? 'error' : undefined}
        stateRelatedMessage={errors.monthlyRent?.message}
        nativeInputProps={{
          ...register('monthlyRent', { valueAsNumber: true }),
          type: 'number',
          min: 0,
          disabled: rentUnknown === true,
        }}
      />
      <Checkbox
        options={[
          {
            label: "Je suis à la recherche d'un logement mais je n'ai pas encore trouvé donc je ne connais pas le montant de mon loyer",
            nativeInputProps: {
              ...register('rentUnknown'),
              onChange: (e) => {
                register('rentUnknown').onChange(e)
                if (e.target.checked) {
                  setValue('monthlyRent', undefined)
                }
              },
            },
          },
        ]}
      />
    </>
  )
}
