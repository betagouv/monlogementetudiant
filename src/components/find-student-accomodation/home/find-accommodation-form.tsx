'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Range from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import { FindStudentAccommodationCitiesAutocompleteInput } from '~/components/find-student-accomodation/home/autocomplete/find-student-accommodations-cities-autocomplete-input'

export const FindAccommodationForm: FC = () => {
  const t = useTranslations('home')
  const { classes } = useStyles()
  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(1000),
    q: parseAsString,
    bbox: parseAsString,
    colocation: parseAsBoolean.withDefault(false),
    accessible: parseAsBoolean.withDefault(false),
  })

  const form = useForm({
    values: {
      maxPrice: queryStates.prix,
      q: queryStates.q,
      bbox: queryStates.bbox,
      coliving: queryStates.colocation,
      accessible: queryStates.accessible,
    },
  })

  const handleOnChangeBudget = (event: React.ChangeEvent<HTMLInputElement>) => setQueryStates({ prix: Number(event.target.value) })

  const searchParams = new URLSearchParams({
    prix: form.getValues('maxPrice').toString(),
    bbox: form.getValues('bbox') ?? '',
    colocation: form.getValues('coliving') ? 'true' : 'false',
    accessible: form.getValues('accessible') ? 'true' : 'false',
    vue: 'carte',
  })

  const href = `/trouver-un-logement-etudiant?${searchParams.toString()}`
  return (
    <>
      <FindStudentAccommodationCitiesAutocompleteInput />
      <Range
        label={t('header.rangeLabel')}
        max={1000}
        min={150}
        hideMinMax
        step={50}
        suffix=" €"
        nativeInputProps={{ onChange: handleOnChangeBudget, value: queryStates.prix }}
      />
      <div className={classes.switchContainer}>
        <FindStudentColivingAccomodationSwitch />
        <FindStudentAccessibleAccomodationSwitch />
      </div>
      <Button size="large" iconId="ri-search-line" linkProps={{ href }} className={classes.searchButton}>
        {t('features.findAccommodation.searchButton')}
      </Button>
    </>
  )
}

const useStyles = tss.create({
  switchContainer: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  searchButton: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
})
