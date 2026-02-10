'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceDetails = () => {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<TUpdateResidence>()
  const t = useTranslations('bailleur.residences.details')
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{t('title')}</h3>
        <Input
          label={
            <>
              {t('accommodationName')} <span className="fr-text-default--error">*</span>
            </>
          }
          nativeInputProps={register('name')}
          state={errors.name ? 'error' : 'default'}
          stateRelatedMessage={errors.name?.message}
        />

        <div className="fr-py-4w">
          <Controller
            name="accept_waiting_list"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                inputTitle="accept_waiting_list"
                label={t('waitingList')}
                labelPosition="left"
                showCheckedHint={false}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="fr-py-4w">
          <Controller
            name="scholarship_holders_priority"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                inputTitle="scholarship_holders_priority"
                label={t('scholarship')}
                labelPosition="left"
                showCheckedHint={false}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>{t('accessible')}</span>
          <Input
            hideLabel
            label={t('accessible')}
            style={{ width: '74px' }}
            className="fr-mr-4w"
            nativeInputProps={{
              ...register('nb_accessible_apartments', { valueAsNumber: true }),
              type: 'number',
              min: 0,
            }}
          />
        </div>
        <div className="fr-py-4w fr-flex fr-justify-content-space-between fr-align-items-center">
          <span>{t('coliving')}</span>
          <Input
            hideLabel
            label={t('coliving')}
            style={{ width: '74px' }}
            className="fr-mr-4w"
            nativeInputProps={{
              ...register('nb_coliving_apartments', { valueAsNumber: true }),
              type: 'number',
              min: 0,
            }}
          />
        </div>
      </div>
    </div>
  )
}
