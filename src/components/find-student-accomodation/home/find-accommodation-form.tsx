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
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'

export const FindAccommodationForm: FC = () => {
  const t = useTranslations('home')
  const { classes } = useStyles()
  const { data, isLoading } = useAccomodations()

  const step = 50
  const min = data?.min_price ? Math.floor(data.min_price / step) * step : undefined
  const max = data?.max_price ? Math.ceil(data.max_price / 100) * 100 : undefined

  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(max ?? 1000),
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

  const city = queryStates.q
  const basePath = city ? `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}` : '/trouver-un-logement-etudiant'
  const href = `${basePath}?${searchParams.toString()}`
  return (
    <>
      <FindStudentAccommodationCitiesAutocompleteInput />
      <Range
        label={t('header.rangeLabel')}
        max={max ?? 1000}
        min={min ?? 0}
        hideMinMax
        disabled={isLoading}
        step={step}
        suffix=" €"
        nativeInputProps={{ onChange: handleOnChangeBudget, value: Math.min(queryStates.prix, max ?? 1000) }}
      />
      <div className={classes.switchContainer}>
        <FindStudentColivingAccomodationSwitch />
        <FindStudentAccessibleAccomodationSwitch />
      </div>
      <Button
        size="large"
        iconId="ri-search-line"
        linkProps={{
          href,
          onClick: () =>
            trackEvent({
              category: 'Recherche',
              action: 'recherche logement',
              name: form.getValues('q') || 'Recherche globale',
            }),
        }}
        className={classes.searchButton}
      >
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
