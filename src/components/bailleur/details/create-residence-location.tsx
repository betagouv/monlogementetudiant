'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { AddressSuggestion, useAddressAutocomplete } from '~/hooks/use-address-autocomplete'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import styles from './create-residence-location.module.css'

const AddressAutocompleteRow = ({ index, onRemove, isMain }: { index: number; onRemove?: () => void; isMain: boolean }) => {
  const {
    setValue,
    formState: { errors },
    watch,
  } = useFormContext<TCreateResidence>()

  const { suggestions, isLoading, searchAddress, clearSuggestions } = useAddressAutocomplete()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedAddress = watch(`addresses.${index}.address`)
  const selectedCity = watch(`addresses.${index}.city`)
  const selectedPostalCode = watch(`addresses.${index}.postal_code`)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowSuggestions(true)
    searchAddress(value)
  }

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.label)
    setValue(`addresses.${index}.address`, suggestion.address, { shouldValidate: true })
    setValue(`addresses.${index}.city`, suggestion.city, { shouldValidate: true })
    setValue(`addresses.${index}.postal_code`, suggestion.postalCode, { shouldValidate: true })
    setShowSuggestions(false)
    clearSuggestions()
  }

  const addressErrors = errors.addresses?.[index]
  const hasAddressError = addressErrors?.address || addressErrors?.city || addressErrors?.postal_code

  const label = isMain ? (
    <>
      Adresse <span className="fr-text-default--error">*</span>
    </>
  ) : (
    `Adresse n\u00B0${index + 1}`
  )

  return (
    <div className="fr-mb-2w">
      <div ref={containerRef} className={styles.container}>
        <div className="fr-flex fr-align-items-end" style={{ gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <Input
              label={label}
              state={hasAddressError ? 'error' : 'default'}
              stateRelatedMessage={hasAddressError ? 'Veuillez sélectionner une adresse valide' : undefined}
              nativeInputProps={{
                value: inputValue,
                onChange: handleInputChange,
                onFocus: () => setShowSuggestions(true),
                onBlur: () => setTimeout(() => setShowSuggestions(false), 200),
                placeholder: 'Rechercher une adresse...',
                autoComplete: 'off',
              }}
            />
          </div>
          {onRemove && (
            <Button
              type="button"
              priority="secondary"
              iconId="ri-delete-bin-line"
              title="Supprimer cette adresse"
              onClick={onRemove}
              style={{ marginBottom: hasAddressError ? '2rem' : '0.75rem' }}
            />
          )}
        </div>
        {showSuggestions && (suggestions.length > 0 || isLoading) && (
          <ul className={styles.suggestionList}>
            {isLoading ? (
              <li className={styles.suggestionLoading}>Recherche en cours...</li>
            ) : (
              suggestions.map((suggestion, i) => (
                <li key={i} onClick={() => handleSelectSuggestion(suggestion)} className={styles.suggestionItem}>
                  {suggestion.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selectedAddress && (
        <div className="fr-mt-1w fr-p-2w fr-background-alt--grey fr-border-radius--8">
          <p className="fr-mb-0 fr-text--sm">
            {selectedAddress}, {selectedPostalCode} {selectedCity}
          </p>
        </div>
      )}
    </div>
  )
}

export const CreateResidenceLocation = () => {
  const { control } = useFormContext<TCreateResidence>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'addresses',
  })

  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Adresse de la résidence</h3>
        <p className="fr-text--sm fr-text-mention--grey">
          Vous pouvez ajouter une ou plusieurs adresses postales si vous disposez de plusieurs résidences dans la même ville.
        </p>

        {fields.map((field, index) => (
          <AddressAutocompleteRow
            key={field.id}
            index={index}
            isMain={index === 0}
            onRemove={index > 0 ? () => remove(index) : undefined}
          />
        ))}

        <Button type="button" priority="secondary" iconId="ri-add-line" onClick={() => append({ address: '', city: '', postal_code: '' })}>
          Ajouter une adresse
        </Button>
      </div>
    </div>
  )
}
