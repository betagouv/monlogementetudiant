'use client'

import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

export const CreateResidencePublication = () => {
  const t = useTranslations('bailleur.residences.details')
  const { control } = useFormContext<TCreateResidence>()

  return (
    <Controller
      name="published"
      control={control}
      render={({ field }) => (
        <SegmentedControl
          legend={t('publishedLegend')}
          hideLegend
          segments={[
            {
              nativeInputProps: {
                onChange: () => field.onChange(true),
                checked: field.value === true,
              },
              label: t('published'),
              iconId: 'ri-cursor-line',
            },
            {
              nativeInputProps: {
                onChange: () => field.onChange(false),
                checked: field.value === false,
              },
              label: t('unpublished'),
              iconId: 'ri-eye-off-line',
            },
          ]}
        />
      )}
    />
  )
}
