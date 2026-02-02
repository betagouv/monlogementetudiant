'use client'

import { Input } from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'

export const HelpSimulatorStep3: FC = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()

  return (
    <>
      <Input
        label={<RequiredLabel>Dans quelle ville cherchez-vous un logement ?</RequiredLabel>}
        state={errors.city ? 'error' : undefined}
        stateRelatedMessage={errors.city?.message}
        nativeInputProps={{
          ...register('city'),
        }}
      />
      <RadioButtons
        legend="Avez-vous un garant ?"
        name="hasGuarantor"
        state={errors.hasGuarantor ? 'error' : undefined}
        stateRelatedMessage={errors.hasGuarantor?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'no',
            },
          },
          {
            label: 'Je ne sais pas',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'unknown',
            },
          },
        ]}
      />
      <RadioButtons
        legend="Allez-vous étudier dans une autre région que celle où vous viviez pendant le lycée (suite à une admission sur Parcoursup) ?"
        name="changingRegion"
        state={errors.changingRegion ? 'error' : undefined}
        stateRelatedMessage={errors.changingRegion?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('changingRegion'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('changingRegion'),
              value: 'no',
            },
          },
        ]}
      />
      <RadioButtons
        legend="Étiez-vous boursier(e) au lycée l'année dernière ?"
        name="boursierLycee"
        state={errors.boursierLycee ? 'error' : undefined}
        stateRelatedMessage={errors.boursierLycee?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('boursierLycee'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('boursierLycee'),
              value: 'no',
            },
          },
        ]}
      />
    </>
  )
}
