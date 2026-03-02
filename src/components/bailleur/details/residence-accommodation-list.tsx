'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { AvailabilityBadge } from '~/components/shared/availability-badge'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { calculateAvailability } from '~/utils/calculateAvailability'

export const ResidenceAccommodationList = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const t = useTranslations('findAccomodation.card')

  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()

  const numberTransform = {
    setValueAs: (value: string) => {
      if (value === '' || value === undefined || value === null) return null
      const num = Number(value)
      return isNaN(num) ? null : num
    },
  }

  const {
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
  } = accommodation.properties
  const nbAvailable = calculateAvailability({
    nb_t1_available,
    nb_t1_bis_available,
    nb_t2_available,
    nb_t3_available,
    nb_t4_available,
    nb_t5_available,
    nb_t6_available,
    nb_t7_more_available,
  })
  const badgeAvailability = (
    <AvailabilityBadge nbAvailable={nbAvailable} noAvailabilityText={t('noAvailability')} availabilityText={t('availability')} as="span" />
  )
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-2w">
          <h3 className="fr-mb-0">{accommodation.properties.nb_total_apartments} logements</h3>
          {badgeAvailability}
        </div>

        <div className="fr-border fr-border-radius--8">
          {[
            {
              type: 'T1',
              available: accommodation.properties.nb_t1_available,
              total: accommodation.properties.nb_t1,
              priceMin: accommodation.properties.price_min_t1,
              priceMax: accommodation.properties.price_max_t1,
              availableField: 'nb_t1_available' as const,
              totalField: 'nb_t1' as const,
              priceMinField: 'price_min_t1' as const,
              priceMaxField: 'price_max_t1' as const,
            },
            {
              type: 'T1 bis',
              available: accommodation.properties.nb_t1_bis_available,
              total: accommodation.properties.nb_t1_bis,
              priceMin: accommodation.properties.price_min_t1_bis,
              priceMax: accommodation.properties.price_max_t1_bis,
              availableField: 'nb_t1_bis_available' as const,
              totalField: 'nb_t1_bis' as const,
              priceMinField: 'price_min_t1_bis' as const,
              priceMaxField: 'price_max_t1_bis' as const,
            },
            {
              type: 'T2',
              available: accommodation.properties.nb_t2_available,
              total: accommodation.properties.nb_t2,
              priceMin: accommodation.properties.price_min_t2,
              priceMax: accommodation.properties.price_max_t2,
              availableField: 'nb_t2_available' as const,
              totalField: 'nb_t2' as const,
              priceMinField: 'price_min_t2' as const,
              priceMaxField: 'price_max_t2' as const,
            },
            {
              type: 'T3',
              available: accommodation.properties.nb_t3_available,
              total: accommodation.properties.nb_t3,
              priceMin: accommodation.properties.price_min_t3,
              priceMax: accommodation.properties.price_max_t3,
              availableField: 'nb_t3_available' as const,
              totalField: 'nb_t3' as const,
              priceMinField: 'price_min_t3' as const,
              priceMaxField: 'price_max_t3' as const,
            },
            {
              type: 'T4',
              available: accommodation.properties.nb_t4_available,
              total: accommodation.properties.nb_t4,
              priceMin: accommodation.properties.price_min_t4,
              priceMax: accommodation.properties.price_max_t4,
              availableField: 'nb_t4_available' as const,
              totalField: 'nb_t4' as const,
              priceMinField: 'price_min_t4' as const,
              priceMaxField: 'price_max_t4' as const,
            },
            {
              type: 'T5',
              available: accommodation.properties.nb_t5_available,
              total: accommodation.properties.nb_t5,
              priceMin: accommodation.properties.price_min_t5,
              priceMax: accommodation.properties.price_max_t5,
              availableField: 'nb_t5_available' as const,
              totalField: 'nb_t5' as const,
              priceMinField: 'price_min_t5' as const,
              priceMaxField: 'price_max_t5' as const,
            },
            {
              type: 'T6',
              available: accommodation.properties.nb_t6_available,
              total: accommodation.properties.nb_t6,
              priceMin: accommodation.properties.price_min_t6,
              priceMax: accommodation.properties.price_max_t6,
              availableField: 'nb_t6_available' as const,
              totalField: 'nb_t6' as const,
              priceMinField: 'price_min_t6' as const,
              priceMaxField: 'price_max_t6' as const,
            },
            {
              type: 'T7+',
              available: accommodation.properties.nb_t7_more_available,
              total: accommodation.properties.nb_t7_more,
              priceMin: accommodation.properties.price_min_t7_more,
              priceMax: accommodation.properties.price_max_t7_more,
              availableField: 'nb_t7_more_available' as const,
              totalField: 'nb_t7_more' as const,
              priceMinField: 'price_min_t7_more' as const,
              priceMaxField: 'price_max_t7_more' as const,
            },
          ].map((typology, index) => (
            <div key={typology.type} className={`fr-p-4w ${index !== 4 ? 'fr-border-bottom' : ''}`}>
              <div className="fr-grid-row fr-grid-row--gutters fr-flex fr-direction-md-row fr-direction-column fr-align-items-end">
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
                <div className="fr-col-md-6">
                  <label className="fr-label fr-mb-0">Loyer CC par personne</label>
                  <div className="fr-grid-row fr-grid-row--gutters">
                    <div className="fr-col-6">
                      <Input
                        label=""
                        hintText="Minimum"
                        iconId="fr-icon-money-euro-circle-line"
                        nativeInputProps={{
                          type: 'number',
                          placeholder: '0',
                          ...register(typology.priceMinField, numberTransform),
                        }}
                      />
                    </div>
                    <div className="fr-col-6">
                      <Input
                        label=""
                        hintText="Maximum"
                        iconId="fr-icon-money-euro-circle-line"
                        nativeInputProps={{
                          type: 'number',
                          placeholder: '0',
                          ...register(typology.priceMaxField, numberTransform),
                        }}
                      />
                    </div>
                  </div>
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
                      disabled: !watch(typology.totalField),
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
