'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { TYPOLOGY_TYPES } from '~/schemas/accommodations/create-residence'
import { isPerPersonTypology } from '~/utils/is-per-person-typology'

type TypologyTabContentProps = {
  index: number
  typologyType?: string
  usedTypes?: string[]
  onDelete?: () => void
}

export const TypologyTabContent = (props: TypologyTabContentProps) => {
  const t = useTranslations('bailleur.residences.details.typologyTab')
  const tTypologies = useTranslations('schemas.typologies')
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext()

  const typologyType = props.typologyType

  // RHF field path within the `typologies` array — keys are camelCase to match ZTypology.
  const getFieldName = (field: string) => `typologies.${props.index}.${field}`

  const getError = (field: string) => {
    const typologyErrors = (errors.typologies as Record<number, Record<string, { message?: string }>> | undefined)?.[props.index]
    return typologyErrors?.[field]
  }

  const numberTransform = {
    setValueAs: (value: string) => {
      if (value === '' || value === undefined || value === null) return undefined
      const num = Number(value)
      return isNaN(num) ? undefined : num
    },
  }

  const nbTotalValue = watch(getFieldName('nbTotal'))
  const isColocation = isPerPersonTypology(typologyType)
  const usedTypes = props.usedTypes ?? []

  return (
    <div className="fr-p-2w">
      <div className="fr-grid-row fr-grid-row--gutters fr-align-items-end">
        <div className="fr-col-12 fr-col-md-6">
          <Select
            label={t('housingType')}
            state={getError('type') ? 'error' : 'default'}
            stateRelatedMessage={getError('type')?.message}
            nativeSelectProps={{
              ...register(getFieldName('type')),
              defaultValue: '',
            }}
          >
            <option value="" disabled>
              {t('selectType')}
            </option>
            {TYPOLOGY_TYPES.filter((type) => !usedTypes.includes(type) || type === typologyType).map((type) => (
              <option key={type} value={type}>
                {tTypologies(type)}
              </option>
            ))}
          </Select>
        </div>

        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-start">
            <label className="fr-label fr-mb-1w">{isColocation ? t('rentPerPerson') : t('rent')}</label>
            {props.onDelete && (
              <Button
                type="button"
                size="small"
                priority="tertiary no outline"
                iconId="ri-delete-bin-6-line"
                title={t('deleteType')}
                onClick={props.onDelete}
              />
            )}
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('minimum')}
                iconId="fr-icon-money-euro-circle-line"
                state={getError('priceMin') ? 'error' : 'default'}
                stateRelatedMessage={getError('priceMin')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  ...register(getFieldName('priceMin'), numberTransform),
                }}
              />
            </div>
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('maximum')}
                iconId="fr-icon-money-euro-circle-line"
                state={getError('priceMax') ? 'error' : 'default'}
                stateRelatedMessage={getError('priceMax')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  ...register(getFieldName('priceMax'), numberTransform),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-justify-content-end fr-mt-2w">
        <div className="fr-col-12 fr-col-md-6">
          <label className="fr-label fr-mb-1w">{t('surface')}</label>
          <div className="fr-grid-row fr-grid-row--gutters">
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('minimum')}
                iconId="ri-shape-line"
                state={getError('superficieMin') ? 'error' : 'default'}
                stateRelatedMessage={getError('superficieMin')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  ...register(getFieldName('superficieMin'), numberTransform),
                }}
              />
            </div>
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('maximum')}
                iconId="ri-shape-line"
                state={getError('superficieMax') ? 'error' : 'default'}
                stateRelatedMessage={getError('superficieMax')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  ...register(getFieldName('superficieMax'), numberTransform),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mt-2w">
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('totalHousing')}
            state={getError('nbTotal') ? 'error' : 'default'}
            stateRelatedMessage={getError('nbTotal')?.message}
            nativeInputProps={{
              type: 'number',
              min: 0,
              ...register(getFieldName('nbTotal'), numberTransform),
            }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('availableHousing')}
            state={getError('nbAvailable') ? 'error' : 'default'}
            stateRelatedMessage={getError('nbAvailable')?.message}
            nativeInputProps={{
              type: 'number',
              min: 0,
              disabled: !nbTotalValue,
              ...register(getFieldName('nbAvailable'), numberTransform),
            }}
          />
        </div>
      </div>
    </div>
  )
}
