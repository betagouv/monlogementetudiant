'use client'

import type { TagProps } from '@codegouvfr/react-dsfr/Tag'
import { TagsGroup } from '@codegouvfr/react-dsfr/TagsGroup'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { trackEvent } from '~/lib/tracking'

export const FindStudentAccommodationTypeTags: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const [queryStates, setQueryStates] = useQueryStates({
    crous: parseAsBoolean,
    colocation: parseAsBoolean,
    accessible: parseAsBoolean,
    page: parseAsInteger,
  })

  const toggle = (key: 'crous' | 'colocation' | 'accessible', action: string) => () => {
    const next = !queryStates[key]
    trackEvent({ category: 'Recherche', action, name: next ? 'active' : 'inactive' })
    setQueryStates({ [key]: next || null, page: 1 }, { shallow: key !== 'crous' })
  }

  const tags: [TagProps, ...TagProps[]] = [
    {
      children: t('crousTag'),
      iconId: 'fr-icon-building-line',
      pressed: !!queryStates.crous,
      nativeButtonProps: { onClick: toggle('crous', 'filtre crous') },
    },
    {
      children: t('shared'),
      iconId: 'fr-icon-team-line',
      pressed: !!queryStates.colocation,
      nativeButtonProps: { onClick: toggle('colocation', 'filtre colocation'), title: t('sharedDescription') },
    },
    {
      children: t('accessibleTag'),
      iconId: 'fr-icon-wheelchair-line',
      pressed: !!queryStates.accessible,
      nativeButtonProps: { onClick: toggle('accessible', 'filtre accessible'), title: t('tooltip.accessible') },
    },
  ]

  return <TagsGroup className="fr-mb-0" tags={tags} />
}
