'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import clsx from 'clsx'
import { useState } from 'react'
import { tss } from 'tss-react'
import { useDebounce } from 'use-debounce'
import { useRentSearch } from '~/hooks/use-rent-search'
import { TRentSearchResult } from '~/schemas/territories'

export const rentSearchModal = createModal({
  id: 'rent-search-modal',
  isOpenedByDefault: false,
})

interface RentSearchModalProps {
  onApply?: (selectedCity: TRentSearchResult) => void
  onCancel?: () => void
}

export const RentSearchModal = ({ onApply, onCancel }: RentSearchModalProps) => {
  const { classes } = useStyles()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<TRentSearchResult | null>(null)

  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const { data, isLoading, error } = useRentSearch(debouncedQuery)

  const handleApply = () => {
    if (selectedCity && onApply) {
      onApply(selectedCity)
    }
    rentSearchModal.close()
  }

  const handleCancel = () => {
    setSearchQuery('')
    setSelectedCity(null)
    if (onCancel) {
      onCancel()
    }
    rentSearchModal.close()
  }

  const handleCitySelect = (city: TRentSearchResult) => {
    setSelectedCity(city)
    setSearchQuery(city.city)
  }

  return (
    <>
      <Button priority="tertiary no outline" className="fr-link fr-text--underline fr-text--sm" {...rentSearchModal.buttonProps}>
        Besoin d'aide pour estimer ?
      </Button>

      <rentSearchModal.Component
        title={
          <>
            <span className={clsx(classes.icon, 'ri-building-line')} />
            <span className="fr-text--bold"> Moyenne des loyers par ville</span>
          </>
        }
        size="large"
      >
        <div className={classes.container}>
          <div className={fr.cx('fr-mb-4w')}>
            <Input
              label="Rechercher une ville"
              hintText="Commencez la saisie, puis choisissez la ville recherchée"
              iconId="ri-search-line"
              nativeInputProps={{ value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: 'Nom de la ville...' }}
            />
          </div>

          {error && (
            <div className={fr.cx('fr-alert', 'fr-alert--error', 'fr-mb-2w')}>
              <p>Erreur lors de la recherche des données de loyer</p>
            </div>
          )}

          {debouncedQuery.length >= 2 && searchQuery !== selectedCity?.city && (
            <div className={classes.resultsContainer}>
              {isLoading ? (
                <div className={fr.cx('fr-p-2w')}>
                  <p>Recherche en cours...</p>
                </div>
              ) : data?.cities.length === 0 ? (
                <div className={fr.cx('fr-p-2w')}>
                  <p>Aucune ville trouvée pour "{debouncedQuery}"</p>
                </div>
              ) : (
                <ul className={classes.cityList}>
                  {data?.cities.map((city) => (
                    <li key={city.city} className={classes.cityItem}>
                      <button
                        type="button"
                        className={`${classes.cityButton} ${selectedCity?.city === city.city ? classes.cityButtonSelected : ''}`}
                        onClick={() => handleCitySelect(city)}
                      >
                        <div className={classes.cityInfo}>
                          <span>{city.city}</span>
                          <span>{city.rentPerM2.toFixed(2)} € / m²</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedCity && (
            <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-py-4w fr-px-2w fr-border">
              <span>Loyer moyen pour 20m²</span>
              <span className="fr-text--bold">{selectedCity.rentFor20M2.toFixed(2)} €</span>
            </div>
          )}
        </div>

        <div className="fr-flex fr-justify-content-end fr-flex-gap-2v fr-mt-2w">
          <Button priority="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button priority="primary" onClick={handleApply} disabled={!selectedCity}>
            Appliquer
          </Button>
        </div>
      </rentSearchModal.Component>
    </>
  )
}

const useStyles = tss.create({
  container: {
    display: 'flex',
    gap: '1rem',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  resultsContainer: {
    marginBottom: '2rem',
    maxHeight: '300px',
    overflowY: 'auto',
    border: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
    borderRadius: fr.spacing('1v'),
  },
  cityList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  cityItem: {
    borderBottom: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  cityButton: {
    width: '100%',
    padding: fr.spacing('2w'),
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: fr.colors.decisions.background.default.grey.hover,
    },
  },
  cityButtonSelected: {
    backgroundColor: fr.colors.decisions.background.actionHigh.blueFrance.default,
    color: fr.colors.decisions.text.inverted.grey.default,
    '&:hover': {
      backgroundColor: fr.colors.decisions.background.actionHigh.blueFrance.hover,
    },
  },
  cityInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    ['::before']: {
      '--icon-size': '2rem',
    },
  },
})
