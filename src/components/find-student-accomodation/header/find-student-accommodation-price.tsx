'use client'

import { Range } from '@codegouvfr/react-dsfr/Range'
import { useTranslations } from 'next-intl'
import { parseAsInteger, useQueryStates } from 'nuqs'

export const FindStudentAccommodationPrice = () => {
  const t = useTranslations('findAccomodation')
  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger.withDefault(1000),
    page: parseAsInteger,
  })

  return (
    <Range
      label={t('header.rangeLabel')}
      max={1000}
      min={150}
      hideMinMax
      step={50}
      suffix=" €"
      style={{ width: '260px' }}
      nativeInputProps={{ value: queryStates.prix, onChange: (e) => setQueryStates({ prix: Number(e.target.value), page: 1 }) }}
    />
  )
}
