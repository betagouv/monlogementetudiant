'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TCreateResidence, TYPOLOGY_LABELS, TYPOLOGY_TYPES } from '~/schemas/accommodations/create-residence'
import { isPerPersonTypology } from '~/utils/is-per-person-typology'
import styles from './create-residence-accommodation-list.module.css'

export const CreateResidenceAccommodationList = () => {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<TCreateResidence>()

  const watchedTypologies = watch('typologies')

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'typologies',
  })

  const numberTransform = {
    setValueAs: (value: string) => {
      if (value === '' || value === undefined || value === null) return undefined
      const num = Number(value)
      return isNaN(num) ? undefined : num
    },
  }

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Logements</h3>

        {errors.typologies?.root && <p className="fr-error-text">{errors.typologies.root.message}</p>}
        {errors.typologies?.message && <p className="fr-error-text">{errors.typologies.message}</p>}

        <div className="fr-border fr-border-radius--8">
          {fields.map((field, index) => (
            <div key={field.id} className="fr-position-relative fr-p-4w fr-border-bottom">
              <div className="fr-flex fr-justify-content-space-between fr-align-items-end fr-flex-gap-4v">
                <div className="fr-col-6">
                  <Select
                    label="Type de logement"
                    state={errors.typologies?.[index]?.type ? 'error' : 'default'}
                    stateRelatedMessage={errors.typologies?.[index]?.type?.message}
                    nativeSelectProps={{
                      ...register(`typologies.${index}.type`),
                      defaultValue: '',
                    }}
                  >
                    <option value="" disabled>
                      Sélectionnez un type
                    </option>
                    {TYPOLOGY_TYPES.filter((type) => !watchedTypologies?.some((t, i) => i !== index && t.type === type)).map((type) => (
                      <option key={type} value={type}>
                        {TYPOLOGY_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="fr-label fr-mb-1w">
                    {isPerPersonTypology(watchedTypologies?.[index]?.type) ? 'Loyer CC par personne' : 'Loyer CC'}
                  </label>
                  <div className="fr-flex fr-flex-gap-4v">
                    <div>
                      <Input
                        label=""
                        hintText="Minimum"
                        iconId="fr-icon-money-euro-circle-line"
                        state={errors.typologies?.[index]?.price_min ? 'error' : 'default'}
                        stateRelatedMessage={errors.typologies?.[index]?.price_min?.message}
                        nativeInputProps={{
                          type: 'number',
                          min: 0,
                          ...register(`typologies.${index}.price_min`, numberTransform),
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        label=""
                        hintText="Maximum"
                        iconId="fr-icon-money-euro-circle-line"
                        state={errors.typologies?.[index]?.price_max ? 'error' : 'default'}
                        stateRelatedMessage={errors.typologies?.[index]?.price_max?.message}
                        nativeInputProps={{
                          type: 'number',
                          min: 0,
                          ...register(`typologies.${index}.price_max`, numberTransform),
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  size="small"
                  priority="tertiary"
                  iconId="ri-delete-bin-6-line"
                  title="Supprimer ce type de logement"
                  onClick={() => remove(index)}
                  className={styles.deleteButton}
                />
              </div>

              <div className="fr-grid-row fr-grid-row--gutters fr-justify-content-end fr-py-2w">
                <div className="fr-col-12 fr-col-md-6">
                  <label className="fr-label fr-mb-1w">Surface (m²)</label>
                  <div className="fr-grid-row fr-grid-row--gutters">
                    <div className="fr-col-6">
                      <Input
                        label=""
                        hintText="Minimum"
                        iconId="ri-shape-line"
                        state={errors.typologies?.[index]?.superficie_min ? 'error' : 'default'}
                        stateRelatedMessage={errors.typologies?.[index]?.superficie_min?.message}
                        nativeInputProps={{
                          type: 'number',
                          min: 1,
                          ...register(`typologies.${index}.superficie_min`, numberTransform),
                        }}
                      />
                    </div>
                    <div className="fr-col-6">
                      <Input
                        label=""
                        hintText="Maximum"
                        iconId="ri-shape-line"
                        state={errors.typologies?.[index]?.superficie_max ? 'error' : 'default'}
                        stateRelatedMessage={errors.typologies?.[index]?.superficie_max?.message}
                        nativeInputProps={{
                          type: 'number',
                          min: 1,
                          ...register(`typologies.${index}.superficie_max`, numberTransform),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-py-2w">
                <div className="fr-col-12 fr-col-md-6">
                  <Input
                    label="Nombre total de logements"
                    state={errors.typologies?.[index]?.nb_total ? 'error' : 'default'}
                    stateRelatedMessage={errors.typologies?.[index]?.nb_total?.message}
                    nativeInputProps={{
                      type: 'number',
                      min: 0,
                      ...register(`typologies.${index}.nb_total`, numberTransform),
                    }}
                  />
                </div>
                <div className="fr-col-12 fr-col-md-6">
                  <Input
                    label="Logements disponibles"
                    state={errors.typologies?.[index]?.nb_available ? 'error' : 'default'}
                    stateRelatedMessage={errors.typologies?.[index]?.nb_available?.message}
                    nativeInputProps={{
                      type: 'number',
                      min: 0,
                      disabled: !watchedTypologies?.[index]?.nb_total,
                      ...register(`typologies.${index}.nb_available`, numberTransform),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {fields.length < TYPOLOGY_TYPES.length && (
            <div className="fr-p-2w fr-flex fr-justify-content-center">
              <Button
                type="button"
                priority="tertiary no outline"
                iconId="ri-add-line"
                onClick={() =>
                  append({
                    type: '' as TCreateResidence['typologies'][number]['type'],
                    price_min: undefined as unknown as number,
                    price_max: undefined as unknown as number,
                    superficie_min: undefined,
                    superficie_max: undefined,
                    colocation: false,
                    nb_total: undefined as unknown as number,
                    nb_available: undefined as unknown as number,
                  })
                }
              >
                Ajouter un type de logement
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
