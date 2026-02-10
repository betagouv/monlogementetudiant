'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { AddressSuggestion, useAddressAutocomplete } from '~/hooks/use-address-autocomplete'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import styles from './create-residence-location.module.css'

export const CreateResidenceLocation = () => {
  const {
    setValue,
    formState: { errors },
    watch,
  } = useFormContext<TCreateResidence>()

  const { suggestions, isLoading, searchAddress, clearSuggestions } = useAddressAutocomplete()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedAddress = watch('address')
  const selectedCity = watch('city')
  const selectedPostalCode = watch('postal_code')

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
    setShowSuggestions(false)
    clearSuggestions()
  }

  const hasAddressError = errors.address || errors.city || errors.postal_code

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Localisation</h3>
        <div ref={containerRef} className={styles.container}>
          <Input
            label={
              <>
                Adresse <span className="fr-text-default--error">*</span>
              </>
            }
            state={hasAddressError ? 'error' : 'default'}
            stateRelatedMessage={hasAddressError ? 'Veuillez sélectionner une adresse valide' : undefined}
            nativeInputProps={{
              value: inputValue,
              onChange: handleInputChange,
              onFocus: () => setShowSuggestions(true),
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
      </div>
    </div>
  )
}
