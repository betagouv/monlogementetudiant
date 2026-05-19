'use client'

import Range from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, useQueryStates } from 'nuqs'
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'

type FindStudentAccommodationPriceProps = {
  pageSize?: number
  widget?: boolean
}

export const FindStudentAccommodationPrice = ({ pageSize, widget }: FindStudentAccommodationPriceProps) => {
  const t = useTranslations('findAccomodation')
  const { data, isLoading } = useAccomodations({ pageSize })

  const step = 50
  const min = data?.min_price ? Math.floor(data.min_price / step) * step : undefined
  const max = data?.max_price ? Math.ceil(data.max_price / 100) * 100 : undefined

  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(max ?? 1000),
    page: parseAsInteger,
    crous: parseAsBoolean,
  })
  const isCrous = !!queryStates.crous

  const prix = Math.min(queryStates.prix, max ?? 1000)
  const [localPrix, setLocalPrix] = useState(prix)

  useEffect(() => {
    setLocalPrix(prix)
  }, [prix])

  const debouncedSetPrix = useDebouncedCallback((nextPrix: number) => {
    trackEvent({ category: 'Recherche', action: 'filtre prix', value: nextPrix })
    setQueryStates({ prix: nextPrix, page: 1 })
  }, 300)

  return (
    <Range
      label={t('header.rangeLabel')}
      max={max ?? 1000}
      min={min ?? 0}
      hideMinMax
      disabled={isLoading || (widget && isCrous)}
      step={step}
      suffix=" €"
      style={{ width: '260px' }}
      nativeInputProps={{
        value: localPrix,
        onChange: (e) => {
          const nextPrix = Number(e.target.value)
          setLocalPrix(nextPrix)
          debouncedSetPrix(nextPrix)
        },
      }}
    />
  )
}
