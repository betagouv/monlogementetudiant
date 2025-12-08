'use client'

import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'

export const FindStudentAccommodationCrousFilter: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const [queryStates, setQueryStates] = useQueryStates({
    crous: parseAsString,
    page: parseAsInteger,
  })

  return (
    <SegmentedControl
      legend={t('accommodations')}
      segments={[
        {
          nativeInputProps: {
            onChange: () => setQueryStates({ crous: 'true', page: 1 }),
            checked: queryStates.crous === 'true',
          },
          label: t('crous'),
        },
        {
          nativeInputProps: {
            onChange: () => setQueryStates({ crous: 'false', page: 1 }),
            checked: queryStates.crous === 'false' || !queryStates.crous,
          },
          label: t('others'),
        },
      ]}
    />
  )
}
