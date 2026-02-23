'use client'

import Range from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { trackEvent } from '~/lib/tracking'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

type FindStudentAccommodationPriceProps = {
  initialData?: TGetAccomodationsResponse
}

export const FindStudentAccommodationPrice = ({ initialData }: FindStudentAccommodationPriceProps) => {
  const t = useTranslations('findAccomodation')

  const step = 50
  const min = Math.floor((initialData?.min_price || 150) / step) * step
  const rawMax = initialData?.max_price ?? 1000
  const max = Math.ceil(rawMax / 100) * 100

  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(max),
    page: parseAsInteger,
    crous: parseAsString,
  })
  const isCrous = queryStates.crous === 'true'
  const prix = Math.min(queryStates.prix, max)

  return (
    <Range
      label={t('header.rangeLabel')}
      max={max}
      min={min}
      hideMinMax
      disabled={isCrous}
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
