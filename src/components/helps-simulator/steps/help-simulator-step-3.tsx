'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import clsx from 'clsx'
import { FC, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { tss } from 'tss-react'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { LiveRegion } from '~/components/ui/live-region'
import { RequiredLabel } from '~/components/ui/required-mark'
import { useCombobox } from '~/hooks/use-combobox'
import { useSearchCities } from '~/hooks/use-search-cities'
import { TCity } from '~/schemas/territories'

export const HelpSimulatorStep3: FC = () => {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()
  const { classes } = useStyles()
  const [showResults, setShowResults] = useState(false)
  const { data, isError, searchQuery, setSearchQuery } = useSearchCities()
  const cityValue = watch('city')

  useEffect(() => {
    if (cityValue && !searchQuery) {
      setSearchQuery(cityValue)
    }
  }, [cityValue, searchQuery, setSearchQuery])

  const handleCityInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setValue('city', event.target.value)
    setShowResults(true)
  }

  const handleCitySelect = (city: TCity) => {
    setValue('city', city.name)
    setSearchQuery(city.name)
    setShowResults(false)
  }

  const suggestions = data ?? []
  const isOpen = suggestions.length > 0 && showResults
  const { inputProps, listboxProps, getOptionProps, activeIndex, announcement } = useCombobox<TCity>({
    id: 'simulateur-ville',
    items: suggestions,
    isOpen,
    onSelect: handleCitySelect,
    onClose: () => setShowResults(false),
  })

  return (
    <>
      <div className={classes.autocompleteContainer}>
        <Input
          label={<RequiredLabel>Dans quelle ville cherchez-vous un logement ?</RequiredLabel>}
          state={errors.city ? 'error' : isError ? 'error' : undefined}
          stateRelatedMessage={errors.city?.message}
          nativeInputProps={{
            ...register('city'),
            onChange: handleCityInputChange,
            value: searchQuery,
            autoComplete: 'address-level2',
            required: true,
            ...inputProps,
          }}
        />
        <LiveRegion message={announcement} />
        {isOpen && (
          <div className={classes.resultsContainer}>
            <ul className={classes.resultsList} {...listboxProps}>
              {suggestions.map((city: TCity, index: number) => (
                <li
                  key={city.id}
                  className={clsx(classes.resultItem, index === activeIndex && classes.resultItemActive)}
                  {...getOptionProps(index)}
                >
                  {city.name} {city.departmentCode ? `(${city.departmentCode})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <RadioButtons
        legend={<RequiredLabel>Avez-vous un garant ?</RequiredLabel>}
        hintText="Un garant, c'est une personne qui s'engage à payer à votre place si vous ne pouvez plus le faire."
        name="hasGuarantor"
        state={errors.hasGuarantor ? 'error' : undefined}
        stateRelatedMessage={errors.hasGuarantor?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'yes',
              'aria-required': true,
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'no',
              'aria-required': true,
            },
          },
          {
            label: 'Je ne sais pas',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'unknown',
              'aria-required': true,
            },
          },
        ]}
      />
    </>
  )
}

const useStyles = tss.create({
  autocompleteContainer: {
    position: 'relative',
    '> .fr-input-group': { marginBottom: 0 },
    [fr.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  resultsContainer: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    left: 0,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 10,
  },
  resultsList: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  resultItem: {
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
    borderBottom: '1px solid #e0e0e0',
    cursor: 'pointer',
    padding: '8px',
  },
  resultItemActive: {
    backgroundColor: '#f0f0f0',
  },
})
