'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import Select from '@codegouvfr/react-dsfr/Select'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { RequiredLabel } from '~/components/ui/required-mark'
import { EResidenceType, RESIDENCE_TYPE_MESSAGE_KEYS } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import styles from './residence-details.module.css'

// Un champ vidé vaut null (non renseigné) : `valueAsNumber` produirait NaN, rejeté par Zod sans message affiché.
const toOptionalNumber = (value: string | number | null | undefined) => (value === '' || value == null ? null : Number(value))

export const ResidenceDetails = () => {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<TUpdateResidence>()
  const t = useTranslations('bailleur.residences.details')
  const tResidenceTypes = useTranslations('accomodation.residenceTypes')
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{t('title')}</h3>
        <div className="fr-flex fr-direction-column fr-flex-gap-6v">
          <div className="fr-grid-row fr-grid-row--gutters">
            <div className="fr-col-12 fr-col-md-6">
              <Input
                classes={{ message: 'fr-flex-gap-2v' }}
                label={<RequiredLabel>{t('accommodationName')}</RequiredLabel>}
                nativeInputProps={register('name')}
                state={errors.name ? 'error' : 'info'}
                stateRelatedMessage={errors.name?.message ?? t('accommodationNameHint')}
              />
            </div>
            <div className="fr-col-12 fr-col-md-6">
              <Select
                label={<RequiredLabel>{t('accommodationType')}</RequiredLabel>}
                nativeSelectProps={{
                  ...register('residenceType'),
                }}
                state={errors.residenceType ? 'error' : 'default'}
                stateRelatedMessage={errors.residenceType?.message}
              >
                <option value="" disabled hidden>
                  {t('selectResidenceType')}
                </option>
                {Object.values(EResidenceType).map((value) => (
                  <option key={value} value={value}>
                    {tResidenceTypes(RESIDENCE_TYPE_MESSAGE_KEYS[value])}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className={styles.radioGrid}>
            <RadioButtons
              legend={<RequiredLabel>{t('targetAudience')}</RequiredLabel>}
              name="targetAudience"
              state={errors.targetAudience ? 'error' : undefined}
              stateRelatedMessage={errors.targetAudience?.message}
              className="fr-mb-0"
              classes={{
                inputGroup: 'fr-my-0 fr-border fr-p-1w',
              }}
              options={[
                {
                  label: t('targetAudienceEtudiantsLabel'),
                  hintText: t('targetAudienceEtudiantsHint'),
                  nativeInputProps: {
                    ...register('targetAudience'),
                    value: ETargetAudience.ETUDIANTS,
                  },
                },
                {
                  label: t('targetAudienceMixteLabel'),
                  hintText: t('targetAudienceMixteHint'),
                  nativeInputProps: {
                    ...register('targetAudience'),
                    value: ETargetAudience.MIXTE,
                  },
                },
                {
                  label: t('targetAudienceDiffusEtudiantsLabel'),
                  hintText: t('targetAudienceDiffusEtudiantsHint'),
                  nativeInputProps: {
                    ...register('targetAudience'),
                    value: ETargetAudience.DIFFUS_ETUDIANTS,
                  },
                },
                {
                  label: t('targetAudienceDiffusMixteLabel'),
                  hintText: t('targetAudienceDiffusMixteHint'),
                  nativeInputProps: {
                    ...register('targetAudience'),
                    value: ETargetAudience.DIFFUS_MIXTE,
                  },
                },
              ]}
            />
          </div>

          <div>
            <div className="fr-py-2w fr-flex fr-justify-content-space-between fr-align-items-center fr-border-bottom">
              <span>{t('waitingList')}</span>
              <Controller
                name="acceptWaitingList"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    inputTitle={t('waitingList')}
                    label=""
                    showCheckedHint={false}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="fr-py-2w fr-flex fr-justify-content-space-between fr-align-items-center fr-border-bottom">
              <span>{t('scholarship')}</span>
              <Controller
                name="scholarshipHoldersPriority"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    inputTitle={t('scholarship')}
                    label=""
                    showCheckedHint={false}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="fr-py-2w fr-flex fr-justify-content-space-between fr-align-items-center fr-border-bottom">
              <span>{t('socialHousing')}</span>
              <Controller
                name="socialHousingRequired"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    inputTitle={t('socialHousing')}
                    label=""
                    showCheckedHint={false}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="fr-py-1w fr-flex fr-justify-content-space-between fr-align-items-center fr-border-bottom">
              <span>{t('accessible')}</span>
              <Input
                hideLabel
                label={t('accessible')}
                className="fr-mr-4w"
                nativeInputProps={{
                  ...register('nbAccessibleApartments', { setValueAs: toOptionalNumber }),
                  style: { width: '74px' },
                  type: 'number',
                  min: 0,
                }}
                state={errors.nbAccessibleApartments ? 'error' : 'default'}
                stateRelatedMessage={errors.nbAccessibleApartments?.message}
              />
            </div>
            <div className="fr-py-1w fr-flex fr-justify-content-space-between fr-align-items-center">
              <span>{t('coliving')}</span>
              <Input
                hideLabel
                label={t('coliving')}
                className="fr-mr-4w"
                nativeInputProps={{
                  ...register('nbColivingApartments', { setValueAs: toOptionalNumber }),
                  style: { width: '74px' },
                  type: 'number',
                  min: 0,
                }}
                state={errors.nbColivingApartments ? 'error' : 'default'}
                stateRelatedMessage={errors.nbColivingApartments?.message}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
