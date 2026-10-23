'use client'

import Range from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsInteger, useQueryStates } from 'nuqs'
import { useEffect, useState } from 'react'
import { useAccomodations } from '~/hooks/use-accomodations'
import { PRICE_FILTER_MIN, PRICE_FILTER_OPTIONS, PRICE_FILTER_STEP } from '~/lib/accommodations-search-params'
import { trackEvent } from '~/lib/tracking'

export const FindStudentAccommodationPriceRange = () => {
  const t = useTranslations('findAccomodation.header')
  const { data, isLoading } = useAccomodations()
  const [{ prix }, setQueryStates] = useQueryStates({ prix: parseAsInteger, page: parseAsInteger })

  // Les bornes sont calculées sans le filtre prix : elles restent stables quand on déplace le curseur.
  const max = data?.maxPrice ? Math.ceil(data.maxPrice / PRICE_FILTER_STEP) * PRICE_FILTER_STEP : Math.max(...PRICE_FILTER_OPTIONS)
  const min = Math.max(0, Math.min(PRICE_FILTER_MIN, max - PRICE_FILTER_STEP))
  const value = prix == null ? max : Math.min(prix, max)

  const [localValue, setLocalValue] = useState(value)
  useEffect(() => setLocalValue(value), [value])

  // On ne relance la recherche qu'au relâchement du curseur, pas à chaque palier franchi.
  const commit = () => {
    const nextPrix = localValue >= max ? null : localValue
    if (nextPrix === prix) return
    trackEvent({ category: 'Recherche', action: 'filtre prix', value: nextPrix ?? 0 })
    setQueryStates({ prix: nextPrix, page: 1 })
  }

  return (
    <Range
      label={t('maxRentLabel')}
      min={min}
      max={max}
      step={PRICE_FILTER_STEP}
      hideMinMax
      suffix=" €"
      disabled={isLoading}
      nativeInputProps={{
        value: localValue,
        onChange: (e) => setLocalValue(Number(e.target.value)),
        onPointerUp: commit,
        onKeyUp: commit,
        onBlur: commit,
      }}
    />
  )
}
