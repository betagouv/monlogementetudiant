'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'

export const HelpSimulatorStep2: FC = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()

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
        label={<RequiredLabel>Montant de votre loyer mensuel</RequiredLabel>}
        hintText="Charges comprises, en euros"
        state={errors.monthlyRent ? 'error' : undefined}
        stateRelatedMessage={errors.monthlyRent?.message}
        nativeInputProps={{
          ...register('monthlyRent', { valueAsNumber: true }),
          type: 'number',
          min: 0,
        }}
      />
    </>
  )
}
