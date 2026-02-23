'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

const Range = dynamic(() => import('@codegouvfr/react-dsfr/Range').then((mod) => ({ default: mod.Range })), { ssr: false })

type FindStudentAccommodationPriceProps = {
  initialData?: TGetAccomodationsResponse
}

export const FindStudentAccommodationPrice = ({ initialData }: FindStudentAccommodationPriceProps) => {
  const t = useTranslations('findAccomodation')
  const { data: accommodations } = useAccomodations({ initialData })
  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(1000),
    page: parseAsInteger,
    crous: parseAsString,
  })

  const isCrous = queryStates.crous === 'true'

  const step = 50
  const min = Math.floor((accommodations?.min_price || 150) / step) * step
  const rawMax = accommodations?.max_price ?? 1000
  const max = Math.ceil(rawMax / 100) * 100
  const prix = Math.min(queryStates.prix, max)

  return (
    <Range
      label={t('header.rangeLabel')}
      max={max}
      min={min}
      hideMinMax
      step={step}
      suffix=" €"
      style={{ width: '260px', opacity: isCrous ? 0.5 : 1, pointerEvents: isCrous ? 'none' : 'auto' }}
      nativeInputProps={{
        value: prix,
        onChange: (e) => {
          const prix = Number(e.target.value)
          trackEvent({ category: 'Recherche', action: 'filtre prix', value: prix })
          setQueryStates({ prix, page: 1 })
        },
        disabled: isCrous,
      }}
    />
  )
}
