'use client'

import Range from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
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
    crous: parseAsString,
  })
  const isCrous = queryStates.crous === 'true'

  const prix = Math.min(queryStates.prix, max ?? 1000)

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
        value: prix,
        onChange: (e) => {
          const prix = Number(e.target.value)
          trackEvent({ category: 'Recherche', action: 'filtre prix', value: prix })
          setQueryStates({ prix, page: 1 })
        },
      }}
    />
  )
}
