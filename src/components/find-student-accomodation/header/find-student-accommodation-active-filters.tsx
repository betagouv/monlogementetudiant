'use client'

import type { TagProps } from '@codegouvfr/react-dsfr/Tag'
import { TagsGroup } from '@codegouvfr/react-dsfr/TagsGroup'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, useQueryStates } from 'nuqs'
import { FC } from 'react'

export const FindStudentAccommodationActiveFilters: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const [queryStates, setQueryStates] = useQueryStates({
    prix: parseAsInteger,
    disponible: parseAsBoolean,
    accessible: parseAsBoolean,
    colocation: parseAsBoolean,
    crous: parseAsBoolean,
    page: parseAsInteger,
  })

  const chips: { label: string; onRemove: () => void }[] = []

  if (queryStates.crous) {
    chips.push({ label: t('crous'), onRemove: () => setQueryStates({ crous: null, page: 1 }) })
  } else if (queryStates.crous === false) {
    chips.push({ label: t('others'), onRemove: () => setQueryStates({ crous: null, page: 1 }) })
  }
  if (queryStates.disponible) {
    chips.push({ label: t('availability'), onRemove: () => setQueryStates({ disponible: null, page: 1 }) })
  }
  if (queryStates.accessible) {
    chips.push({ label: t('accessbility'), onRemove: () => setQueryStates({ accessible: null, page: 1 }) })
  }
  if (queryStates.colocation) {
    chips.push({ label: t('shared'), onRemove: () => setQueryStates({ colocation: null, page: 1 }) })
  }
  if (queryStates.prix !== null) {
    chips.push({ label: t('priceChip', { prix: queryStates.prix }), onRemove: () => setQueryStates({ prix: null, page: 1 }) })
  }

  if (chips.length === 0) return null

  const tags = chips.map<TagProps>(({ label, onRemove }) => ({
    nativeButtonProps: {
      onClick: onRemove,
      'aria-label': t('removeFilter', { filter: label }),
    },
    dismissible: true,
    children: label,
  }))

  return <TagsGroup tags={tags as [TagProps, ...TagProps[]]} />
}
