'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { getTypologyLabel, TYPOLOGY_TYPES } from '~/schemas/accommodations/create-residence'
import { isPerPersonTypology } from '~/utils/is-per-person-typology'

type FieldPath = string

type TypologyTabContentProps =
  | {
      mode: 'create'
      index: number
      typologyType?: string
      usedTypes?: string[]
      onDelete: () => void
    }
  | {
      mode: 'update'
      fieldSuffix: string
      typologyType: string
      isImported: boolean
      onDelete?: () => void
    }
  | {
      mode: 'update-new'
      fieldSuffix: string | null
      availableTypes: Array<{ type: string; fieldSuffix: string }>
      onTypeSelect: (fieldSuffix: string) => void
      onDelete?: () => void
    }

export const TypologyTabContent = (props: TypologyTabContentProps) => {
  const isImported = props.mode === 'update' ? props.isImported : false
  const t = useTranslations('bailleur.residences.details.typologyTab')
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext()

  // Pour le mode update-new sans type sélectionné, afficher le même layout que create
  if (props.mode === 'update-new' && props.fieldSuffix === null) {
    return (
      <div className="fr-p-2w">
        <div className="fr-grid-row fr-grid-row--gutters fr-align-items-end">
          <div className="fr-col-12 fr-col-md-6">
            <Select
              label={t('housingType')}
              nativeSelectProps={{
                defaultValue: '',
                onChange: (e) => {
                  if (e.target.value) {
                    props.onTypeSelect(e.target.value)
                  }
                },
              }}
            >
              <option value="" disabled>
                {t('selectType')}
              </option>
              {props.availableTypes.map(({ type, fieldSuffix }) => (
                <option key={fieldSuffix} value={fieldSuffix}>
                  {getTypologyLabel(type)}
                </option>
              ))}
            </Select>
          </div>
          <div className="fr-col-12 fr-col-md-6">
            <div className="fr-flex fr-justify-content-space-between fr-align-items-start">
              <label className="fr-label fr-mb-1w">{t('rent')}</label>
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
                  nativeInputProps={{ type: 'number', min: 0 }}
                />
              </div>
              <div className="fr-col-6">
                <Input
                  label=""
                  hintText={t('maximum')}
                  iconId="fr-icon-money-euro-circle-line"
                  nativeInputProps={{ type: 'number', min: 0 }}
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
                <Input label="" hintText={t('minimum')} iconId="ri-shape-line" nativeInputProps={{ type: 'number', min: 1 }} />
              </div>
              <div className="fr-col-6">
                <Input label="" hintText={t('maximum')} iconId="ri-shape-line" nativeInputProps={{ type: 'number', min: 1 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="fr-grid-row fr-grid-row--gutters fr-mt-2w">
          <div className="fr-col-12 fr-col-md-6">
            <Input label={t('totalHousing')} nativeInputProps={{ type: 'number', min: 0 }} />
          </div>
          <div className="fr-col-12 fr-col-md-6">
            <Input label={t('availableHousing')} nativeInputProps={{ type: 'number', min: 0 }} />
          </div>
        </div>
      </div>
    )
  }

  const fieldSuffix = props.mode === 'create' ? null : props.fieldSuffix
  const typologyType =
    props.mode === 'create'
      ? props.typologyType
      : props.mode === 'update'
        ? props.typologyType
        : props.availableTypes.find((t) => t.fieldSuffix === props.fieldSuffix)?.type

  const getFieldName = (field: string): FieldPath => {
    if (props.mode === 'create') {
      return `typologies.${props.index}.${field}`
    }
    if (field === 'type') return ''
    if (field === 'nb_total') return `nb_${fieldSuffix}`
    if (field === 'nb_available') return `nb_${fieldSuffix}_available`
    return `${field}_${fieldSuffix}`
  }

  const getError = (field: string) => {
    if (props.mode === 'create') {
      const typologyErrors = (errors.typologies as Record<number, Record<string, { message?: string }>> | undefined)?.[props.index]
      return typologyErrors?.[field]
    }
    const fieldName = getFieldName(field)
    return (errors as Record<string, { message?: string }>)[fieldName]
  }

  const numberTransform = {
    setValueAs: (value: string) => {
      if (value === '' || value === undefined || value === null) return props.mode === 'create' ? undefined : null
      const num = Number(value)
      return isNaN(num) ? (props.mode === 'create' ? undefined : null) : num
    },
  }

  const nbTotalFieldName = getFieldName('nb_total')
  const nbTotalValue = watch(nbTotalFieldName)
  const isColocation = isPerPersonTypology(typologyType)
  const usedTypes = props.mode === 'create' ? (props.usedTypes ?? []) : []

  return (
    <div className="fr-p-2w">
      <div className="fr-grid-row fr-grid-row--gutters fr-align-items-end">
        <div className="fr-col-12 fr-col-md-6">
          <Select
            label={t('housingType')}
            disabled={props.mode === 'update' && isImported}
            state={getError('type') ? 'error' : 'default'}
            stateRelatedMessage={getError('type')?.message}
            nativeSelectProps={
              props.mode === 'create'
                ? {
                    ...register(getFieldName('type')),
                    defaultValue: '',
                  }
                : {
                    defaultValue: typologyType,
                    disabled: isImported,
                  }
            }
          >
            <option value="" disabled>
              {t('selectType')}
            </option>
            {TYPOLOGY_TYPES.filter((type) => !usedTypes.includes(type) || type === typologyType).map((type) => (
              <option key={type} value={type}>
                {getTypologyLabel(type)}
              </option>
            ))}
          </Select>
        </div>

        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-start">
            <label className="fr-label fr-mb-1w">{isColocation ? t('rentPerPerson') : t('rent')}</label>
            {(props.mode === 'create' ||
              (props.mode === 'update' && !isImported && props.onDelete) ||
              (props.mode === 'update-new' && props.onDelete)) && (
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
                disabled={isImported}
                state={getError('price_min') ? 'error' : 'default'}
                stateRelatedMessage={getError('price_min')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  ...register(getFieldName('price_min'), numberTransform),
                }}
              />
            </div>
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('maximum')}
                iconId="fr-icon-money-euro-circle-line"
                disabled={isImported}
                state={getError('price_max') ? 'error' : 'default'}
                stateRelatedMessage={getError('price_max')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  ...register(getFieldName('price_max'), numberTransform),
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
                disabled={isImported}
                state={getError('superficie_min') ? 'error' : 'default'}
                stateRelatedMessage={getError('superficie_min')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  ...register(getFieldName('superficie_min'), numberTransform),
                }}
              />
            </div>
            <div className="fr-col-6">
              <Input
                label=""
                hintText={t('maximum')}
                iconId="ri-shape-line"
                disabled={isImported}
                state={getError('superficie_max') ? 'error' : 'default'}
                stateRelatedMessage={getError('superficie_max')?.message}
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  ...register(getFieldName('superficie_max'), numberTransform),
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
            disabled={isImported}
            state={getError('nb_total') ? 'error' : 'default'}
            stateRelatedMessage={getError('nb_total')?.message}
            nativeInputProps={{
              type: 'number',
              min: 0,
              ...register(getFieldName('nb_total'), numberTransform),
            }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('availableHousing')}
            disabled={isImported}
            state={getError('nb_available') ? 'error' : 'default'}
            stateRelatedMessage={getError('nb_available')?.message}
            nativeInputProps={{
              type: 'number',
              min: 0,
              disabled: isImported || !nbTotalValue,
              ...register(getFieldName('nb_available'), numberTransform),
            }}
          />
        </div>
      </div>
    </div>
  )
}
