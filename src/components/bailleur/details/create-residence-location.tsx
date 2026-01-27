'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { AddressSuggestion, useAddressAutocomplete } from '~/hooks/use-address-autocomplete'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'

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
    setValue('longitude', suggestion.longitude, { shouldValidate: true })
    setValue('latitude', suggestion.latitude, { shouldValidate: true })
    setShowSuggestions(false)
    clearSuggestions()
  }

  const handleBlur = () => {
    // Delay hiding suggestions to allow click to register
    setTimeout(() => {
      setShowSuggestions(false)
    }, 200)
  }

  const hasAddressError = errors.address || errors.city || errors.postal_code || errors.longitude || errors.latitude

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Localisation</h3>
        <div ref={containerRef} style={{ position: 'relative' }}>
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
              onBlur: handleBlur,
              placeholder: 'Rechercher une adresse...',
              autoComplete: 'off',
            }}
          />
          {showSuggestions && (suggestions.length > 0 || isLoading) && (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: 'white',
                border: '1px solid var(--border-default-grey)',
                borderRadius: '0 0 4px 4px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {isLoading ? (
                <li style={{ padding: '0.75rem 1rem', color: 'var(--text-mention-grey)' }}>Recherche en cours...</li>
              ) : (
                suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-default-grey)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--background-contrast-grey)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                    }}
                  >
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
