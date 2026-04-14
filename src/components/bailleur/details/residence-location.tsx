'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { AddressSuggestion, useAddressAutocomplete } from '~/hooks/use-address-autocomplete'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import styles from './residence-location.module.css'

const AddressAutocompleteRow = ({
  index,
  onRemove,
  isMain,
  initialValue,
}: {
  index: number
  onRemove?: () => void
  isMain: boolean
  initialValue?: string
}) => {
  const {
    setValue,
    formState: { errors },
    watch,
  } = useFormContext<TUpdateResidence>()

  const { suggestions, isLoading, searchAddress, clearSuggestions } = useAddressAutocomplete()
  const [inputValue, setInputValue] = useState(initialValue ?? '')
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

  const label = isMain ? 'Adresse' : `Adresse n\u00B0${index + 1}`

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
              style={{ marginBottom: hasAddressError ? '2rem' : '0rem' }}
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

export const ResidenceLocation = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { geometry } = accommodation
  const [longitude, latitude] = geometry.coordinates

  const { control } = useFormContext<TUpdateResidence>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'addresses',
  })

  return (
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
          initialValue={field.address ? `${field.address} ${field.postal_code} ${field.city}` : ''}
        />
      ))}

      <Button
        type="button"
        priority="secondary"
        iconId="ri-add-line"
        className="fr-mb-2w"
        onClick={() => append({ address: '', city: '', postal_code: '' })}
      >
        Ajouter une adresse
      </Button>

      <div className="fr-mt-2w" style={{ height: '300px', width: '100%' }}>
        <AccommodationMap key={`${latitude}-${longitude}`} latitude={latitude} longitude={longitude} />
      </div>
    </div>
  )
}
