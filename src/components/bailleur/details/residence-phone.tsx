'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { RequiredLabel } from '~/components/ui/required-mark'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidencePhone = ({ className }: { className?: string }) => {
  const t = useTranslations('bailleur.residences.details.phone')
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()
  const phoneNumber = watch('phoneNumber')
  const isEnabled = phoneNumber != null

  return (
    <div className={className}>
      <div className="fr-px-2w fr-px-md-6w fr-pt-4w fr-pb-2w">
        <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-gap-4v">
          <div className="fr-flex fr-direction-column">
            <span className="fr-mb-0">{t('toggle')}</span>
            <span id="accommodation-phone-hint" className="fr-mb-0 fr-text--xs fr-text-mention--grey">
              {t('hint')}
            </span>
          </div>
          <ToggleSwitch
            inputTitle={t('toggle')}
            label=""
            showCheckedHint={false}
            checked={isEnabled}
            onChange={(checked) => setValue('phoneNumber', checked ? '' : null, { shouldDirty: true, shouldValidate: !checked })}
          />
        </div>
        {isEnabled && (
          <Input
            className="fr-mt-3w fr-mb-0"
            label={<RequiredLabel>{t('label')}</RequiredLabel>}
            nativeInputProps={{
              ...register('phoneNumber'),
              type: 'tel',
              autoComplete: 'tel',
              'aria-describedby': 'accommodation-phone-hint',
            }}
            state={errors.phoneNumber ? 'error' : 'default'}
            stateRelatedMessage={errors.phoneNumber?.message}
          />
        )}
      </div>
    </div>
  )
}
