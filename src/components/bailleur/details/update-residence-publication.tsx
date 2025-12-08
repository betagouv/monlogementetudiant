'use client'

import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const UpdateResidencePublication = ({ onSubmit }: { onSubmit: (data: TUpdateResidence) => void }) => {
  const t = useTranslations('bailleur.residences.details')
  const { control, getValues } = useFormContext<TUpdateResidence>()

  return (
    <Controller
      name="published"
      control={control}
      render={({ field }) => {
        const handleOnChange = (value: boolean) => {
          field.onChange(value)
          onSubmit(getValues())
        }

        return (
          <SegmentedControl
            legend={t('publishedLegend')}
            hideLegend
            segments={[
              {
                nativeInputProps: {
                  onChange: () => handleOnChange(true),
                  checked: field.value === true,
                },
                label: t('published'),
                iconId: 'ri-cursor-line',
              },
              {
                nativeInputProps: {
                  onChange: () => handleOnChange(false),
                  checked: field.value === false,
                },
                label: t('unpublished'),
                iconId: 'ri-eye-off-line',
              },
            ]}
          />
        )
      }}
    />
  )
}
