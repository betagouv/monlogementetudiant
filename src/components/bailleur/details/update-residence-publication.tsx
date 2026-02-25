'use client'

import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { trackEvent } from '~/lib/tracking'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const UpdateResidencePublication = ({ onSubmit, slug }: { onSubmit: (data: TUpdateResidence) => void; slug: string }) => {
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
          trackEvent({
            category: 'Espace Gestionnaire',
            action: value ? 'publication residence' : 'depublication residence',
            name: slug,
          })
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
