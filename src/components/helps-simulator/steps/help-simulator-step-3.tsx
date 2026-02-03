'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { FC, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { tss } from 'tss-react'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'
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
  console.log('data', data)
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
            autoComplete: 'off',
          }}
        />
        {data && data.length > 0 && showResults && (
          <div className={classes.resultsContainer}>
            <ul className={classes.resultsList}>
              {data.map((city: TCity) => (
                <li key={city.id} className={classes.resultItem} onClick={() => handleCitySelect(city)}>
                  {city.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <RadioButtons
        legend="Avez-vous un garant ?"
        name="hasGuarantor"
        state={errors.hasGuarantor ? 'error' : undefined}
        stateRelatedMessage={errors.hasGuarantor?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'no',
            },
          },
          {
            label: 'Je ne sais pas',
            nativeInputProps: {
              ...register('hasGuarantor'),
              value: 'unknown',
            },
          },
        ]}
      />
      {/* Questions Parcoursup - désactivées pour la prochaine release
      <RadioButtons
        legend="Allez-vous étudier dans une autre région que celle où vous viviez pendant le lycée (suite à une admission sur Parcoursup) ?"
        name="changingRegion"
        state={errors.changingRegion ? 'error' : undefined}
        stateRelatedMessage={errors.changingRegion?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('changingRegion'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('changingRegion'),
              value: 'no',
            },
          },
        ]}
      />
      <RadioButtons
        legend="Étiez-vous boursier(e) au lycée l'année dernière ?"
        name="boursierLycee"
        state={errors.boursierLycee ? 'error' : undefined}
        stateRelatedMessage={errors.boursierLycee?.message}
        options={[
          {
            label: 'Oui',
            nativeInputProps: {
              ...register('boursierLycee'),
              value: 'yes',
            },
          },
          {
            label: 'Non',
            nativeInputProps: {
              ...register('boursierLycee'),
              value: 'no',
            },
          },
        ]}
      />
      */}
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
})
