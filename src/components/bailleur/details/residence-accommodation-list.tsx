'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { sPluriel } from '~/utils/sPluriel'

export const ResidenceAccommodationList = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  const { nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available } = accommodation
  const availabilityValues = [nb_t1_available, nb_t1_bis_available, nb_t2_available, nb_t3_available, nb_t4_more_available]
  const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
  const nbAvailable = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null
  const badgeAvailability =
    nbAvailable !== null && nbAvailable !== undefined ? (
      nbAvailable === 0 ? (
        <Badge severity="error" noIcon>
          <span className="fr-text--uppercase fr-mb-0">Disponibilité non communiquée</span>
        </Badge>
      ) : (
        <Badge severity="success" noIcon>
          {nbAvailable}&nbsp;
          <span className="fr-text--uppercase fr-mb-0">
            DISPONIBILITÉ
            {sPluriel(nbAvailable)}
          </span>
        </Badge>
      )
    ) : null
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-2w">
          <h3 className="fr-mb-0">{accommodation.nb_total_apartments} logements</h3>
          {badgeAvailability}
        </div>

        <div className="fr-border fr-border-radius--8">
          {[
            {
              type: 'T1',
              available: accommodation.nb_t1_available,
              total: accommodation.nb_t1,
              priceMin: accommodation.price_min_t1,
              priceMax: accommodation.price_max_t1,
            },
            {
              type: 'T1 bis',
              available: accommodation.nb_t1_bis_available,
              total: accommodation.nb_t1_bis,
              priceMin: accommodation.price_min_t1_bis,
              priceMax: accommodation.price_max_t1_bis,
            },
            {
              type: 'T2',
              available: accommodation.nb_t2_available,
              total: accommodation.nb_t2,
              priceMin: accommodation.price_min_t2,
              priceMax: accommodation.price_max_t2,
            },
            {
              type: 'T3',
              available: accommodation.nb_t3_available,
              total: accommodation.nb_t3,
              priceMin: accommodation.price_min_t3,
              priceMax: accommodation.price_max_t3,
            },
            {
              type: 'T4+',
              available: accommodation.nb_t4_more_available,
              total: accommodation.nb_t4_more,
              priceMin: accommodation.price_min_t4_more,
              priceMax: accommodation.price_max_t4_more,
            },
          ].map((typology, index) => (
            <div key={typology.type} className={`fr-p-4w ${index !== 4 ? 'fr-border-bottom' : ''}`}>
              {/* First row: Type de Logement and Loyer inputs */}
              <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
                <div className="fr-col-6">
                  <Select
                    label="Type de Logement"
                    nativeSelectProps={{
                      value: typology.type,
                    }}
                  >
                    <option value="T1">Studio T1</option>
                    <option value="T1 bis">Studio T1 bis</option>
                    <option value="T2">Logement T2</option>
                    <option value="T3">Logement T3</option>
                    <option value="T4+">Logement T4+</option>
                  </Select>
                </div>
                <div className="fr-col-3">
                  <Input
                    label="Loyer min."
                    iconId="fr-icon-money-euro-circle-line"
                    nativeInputProps={{
                      type: 'number',
                      value: typology.priceMin || '',
                      placeholder: '0',
                    }}
                  />
                </div>
                <div className="fr-col-3">
                  <Input
                    label="Loyer max."
                    iconId="fr-icon-money-euro-circle-line"
                    nativeInputProps={{
                      type: 'number',
                      value: typology.priceMax || '',
                      placeholder: '0',
                    }}
                  />
                </div>
              </div>

              {/* Second row: Total and Available inputs */}
              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-6">
                  <Input
                    label="Nombre total de logements"
                    nativeInputProps={{
                      type: 'number',
                      value: typology.total || '',
                      placeholder: '0',
                    }}
                  />
                </div>
                <div className="fr-col-6">
                  <Input
                    label="Logements disponibles"
                    nativeInputProps={{
                      type: 'number',
                      value: typology.available || '',
                      placeholder: '0',
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
