'use client'

import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Range } from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/ui/required-mark'

export const HelpSimulatorStep2: FC = () => {
  const t = useTranslations('simulator.form.resources')
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
        label={<RequiredLabel>{t('incomeLabel')}</RequiredLabel>}
        hintText={t('incomeHint')}
        state={errors.monthlyIncome ? 'error' : undefined}
        stateRelatedMessage={errors.monthlyIncome?.message}
        nativeInputProps={{
          ...register('monthlyIncome', { valueAsNumber: true }),
          'aria-required': true,
          type: 'number',
          min: 0,
        }}
      />
      <div>
        <Range
          label={rentUnknown ? t('rentLabel') : <RequiredLabel>{t('rentLabel')}</RequiredLabel>}
          hintText={t('rentHint')}
          min={100}
          max={1000}
          step={20}
          suffix=" €"
          disabled={rentUnknown === true}
          state={errors.monthlyRent ? 'error' : 'default'}
          stateRelatedMessage={errors.monthlyRent?.message}
          nativeInputProps={{
            // Le loyer n'est obligatoire que si l'utilisateur déclare le connaître.
            'aria-required': !rentUnknown,
            value: rentUnknown ? 0 : (monthlyRent ?? 0),
            onChange: (e) => setValue('monthlyRent', Number(e.target.value)),
            disabled: rentUnknown === true,
          }}
        />
        <Checkbox
          className="fr-mt-0"
          options={[
            {
              label: t('rentUnknown'),
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
