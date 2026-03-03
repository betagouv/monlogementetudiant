'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { AddressSuggestion, useAddressAutocomplete } from '~/hooks/use-address-autocomplete'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import styles from './residence-location.module.css'

export const ResidenceLocation = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { geometry } = accommodation
  const [longitude, latitude] = geometry.coordinates

  const {
    register,
    setValue,
    formState: { errors },
    watch,
  } = useFormContext<TUpdateResidence>()

  const { suggestions, isLoading, searchAddress, clearSuggestions } = useAddressAutocomplete()
  const [inputValue, setInputValue] = useState(
    `${accommodation.properties.address} ${accommodation.properties.postal_code} ${accommodation.properties.city}`,
  )
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: latitude, lng: longitude })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowSuggestions(true)
    searchAddress(value)
  }

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.label)
    setValue('address', suggestion.address, { shouldValidate: true })
    setValue('city', suggestion.city, { shouldValidate: true })
    setValue('postal_code', suggestion.postalCode, { shouldValidate: true })
    setMapCenter({ lat: suggestion.latitude, lng: suggestion.longitude })
    setShowSuggestions(false)
    clearSuggestions()
  }

  const hasAddressError = errors.address || errors.city || errors.postal_code

  const selectedAddress = watch('address')
  const selectedCity = watch('city')
  const selectedPostalCode = watch('postal_code')

  return (
    <div className="fr-p-2w fr-p-md-6w">
      <h3>Localisation</h3>
      <div ref={containerRef} className={styles.container}>
        <Input
          label="Adresse"
          state={hasAddressError ? 'error' : 'default'}
          stateRelatedMessage={hasAddressError ? 'Veuillez sélectionner une adresse valide' : undefined}
          nativeInputProps={{
            ...register('address'),
            value: inputValue,
            onChange: handleInputChange,
            onFocus: () => setShowSuggestions(true),
            onBlur: () => setTimeout(() => setShowSuggestions(false), 200),
            placeholder: 'Rechercher une adresse...',
            autoComplete: 'off',
          }}
        />
        {showSuggestions && (suggestions.length > 0 || isLoading) && (
          <ul className={styles.suggestionList}>
            {isLoading ? (
              <li className={styles.suggestionLoading}>Recherche en cours...</li>
            ) : (
              suggestions.map((suggestion, index) => (
                <li key={index} onClick={() => handleSelectSuggestion(suggestion)} className={styles.suggestionItem}>
                  {suggestion.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selectedAddress && (
        <div className="fr-mt-2w fr-p-2w fr-background-alt--grey fr-border-radius--8">
          <p className="fr-mb-1v fr-text--sm fr-text-mention--grey">Adresse sélectionnée :</p>
          <p className="fr-mb-0 fr-text--bold">
            {selectedAddress}, {selectedPostalCode} {selectedCity}
          </p>
        </div>
      )}

      <div className="fr-mt-2w" style={{ height: '300px', width: '100%' }}>
        <AccommodationMap key={`${mapCenter.lat}-${mapCenter.lng}`} latitude={mapCenter.lat} longitude={mapCenter.lng} />
      </div>
    </div>
  )
}
