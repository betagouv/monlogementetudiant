'use client'

import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Range } from '@codegouvfr/react-dsfr/Range'
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
  const monthlyRent = watch('monthlyRent')

  return (
    <>
      <Input
        label={<RequiredLabel>Vos revenus mensuels</RequiredLabel>}
        state={errors.monthlyIncome ? 'error' : undefined}
        stateRelatedMessage={errors.monthlyIncome?.message}
        nativeInputProps={{
          ...register('monthlyIncome', { valueAsNumber: true }),
          type: 'number',
          min: 0,
        }}
      />
      <div>
        <Range
          label={rentUnknown ? 'Montant de votre loyer mensuel' : <RequiredLabel>Montant de votre loyer mensuel</RequiredLabel>}
          hintText="Hors charges, en euros"
          min={100}
          max={1000}
          step={20}
          suffix=" €"
          disabled={rentUnknown === true}
          state={errors.monthlyRent ? 'error' : 'default'}
          stateRelatedMessage={errors.monthlyRent?.message}
          nativeInputProps={{
            value: rentUnknown ? 0 : (monthlyRent ?? 0),
            onChange: (e) => setValue('monthlyRent', Number(e.target.value)),
            disabled: rentUnknown === true,
          }}
        />
        <Checkbox
          className="fr-mt-0"
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
      </div>
    </>
  )
}
