'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { useFormContext } from 'react-hook-form'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

export const CreateResidenceAccommodationList = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<TCreateResidence>()

  const numberTransform = {
    setValueAs: (value: string) => {
      if (value === '' || value === undefined || value === null) return null
      const num = Number(value)
      return isNaN(num) ? null : num
    },
  }

  const typologies = [
    {
      type: 'T1',
      totalField: 'nb_t1' as const,
      availableField: 'nb_t1_available' as const,
      priceMinField: 'price_min_t1' as const,
      priceMaxField: 'price_max_t1' as const,
    },
    {
      type: 'T1 bis',
      totalField: 'nb_t1_bis' as const,
      availableField: 'nb_t1_bis_available' as const,
      priceMinField: 'price_min_t1_bis' as const,
      priceMaxField: 'price_max_t1_bis' as const,
    },
    {
      type: 'T2',
      totalField: 'nb_t2' as const,
      availableField: 'nb_t2_available' as const,
      priceMinField: 'price_min_t2' as const,
      priceMaxField: 'price_max_t2' as const,
    },
    {
      type: 'T3',
      totalField: 'nb_t3' as const,
      availableField: 'nb_t3_available' as const,
      priceMinField: 'price_min_t3' as const,
      priceMaxField: 'price_max_t3' as const,
    },
    {
      type: 'T4',
      totalField: 'nb_t4' as const,
      availableField: 'nb_t4_available' as const,
      priceMinField: 'price_min_t4' as const,
      priceMaxField: 'price_max_t4' as const,
    },
    {
      type: 'T5',
      totalField: 'nb_t5' as const,
      availableField: 'nb_t5_available' as const,
      priceMinField: 'price_min_t5' as const,
      priceMaxField: 'price_max_t5' as const,
    },
    {
      type: 'T6',
      totalField: 'nb_t6' as const,
      availableField: 'nb_t6_available' as const,
      priceMinField: 'price_min_t6' as const,
      priceMaxField: 'price_max_t6' as const,
    },
    {
      type: 'T7+',
      totalField: 'nb_t7_more' as const,
      availableField: 'nb_t7_more_available' as const,
      priceMinField: 'price_min_t7_more' as const,
      priceMaxField: 'price_max_t7_more' as const,
    },
  ]

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Logements</h3>

        <div className="fr-border fr-border-radius--8">
          {typologies.map((typology, index) => (
            <div key={typology.type} className={`fr-p-4w ${index !== typologies.length - 1 ? 'fr-border-bottom' : ''}`}>
              <div className="fr-grid-row fr-grid-row--gutters fr-flex fr-direction-md-row fr-direction-column">
                <div className="fr-col-md-6">
                  <Select
                    label="Type de Logement"
                    nativeSelectProps={{
                      defaultValue: typology.type,
                    }}
                  >
                    <option value="T1">Studio T1</option>
                    <option value="T1 bis">Studio T1 bis</option>
                    <option value="T2">Logement T2</option>
                    <option value="T3">Logement T3</option>
                    <option value="T4">Logement T4</option>
                    <option value="T5">Logement T5</option>
                    <option value="T6">Logement T6</option>
                    <option value="T7+">Logement T7+</option>
                  </Select>
                </div>
                <div className="fr-col-md-3">
                  <Input
                    label="Loyer min."
                    iconId="fr-icon-money-euro-circle-line"
                    nativeInputProps={{
                      type: 'number',
                      placeholder: '0',
                      ...register(typology.priceMinField, numberTransform),
                    }}
                  />
                </div>
                <div className="fr-col-md-3">
                  <Input
                    label="Loyer max."
                    iconId="fr-icon-money-euro-circle-line"
                    nativeInputProps={{
                      type: 'number',
                      placeholder: '0',
                      ...register(typology.priceMaxField, numberTransform),
                    }}
                  />
                </div>
              </div>

              <div className="fr-grid-row fr-grid-row--gutters fr-flex fr-direction-md-row fr-direction-column">
                <div className="fr-col-md-6">
                  <Input
                    label="Nombre total de logements"
                    state={errors[typology.totalField] ? 'error' : 'default'}
                    stateRelatedMessage={errors[typology.totalField]?.message}
                    nativeInputProps={{
                      type: 'number',
                      ...register(typology.totalField, numberTransform),
                    }}
                  />
                </div>
                <div className="fr-col-md-6">
                  <Input
                    label="Logements disponibles"
                    state={errors[typology.availableField] ? 'error' : 'default'}
                    stateRelatedMessage={errors[typology.availableField]?.message}
                    nativeInputProps={{
                      type: 'number',
                      placeholder: '0',
                      ...register(typology.availableField, numberTransform),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
