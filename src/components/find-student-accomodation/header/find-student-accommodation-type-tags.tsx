'use client'

import { Tag, type TagProps } from '@codegouvfr/react-dsfr/Tag'
import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip'
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
  const toggleCrous = toggle('crous', 'filtre crous')

  const tags: (TagProps & { tooltip?: string })[] = [
    {
      children: t('crousTag'),
      iconId: 'fr-icon-building-line',
      pressed: !!queryStates.crous,
      nativeButtonProps: { onClick: toggleCrous },
      tooltip: t('tooltip.crous'),
    },
    {
      children: t('nonCrousTag'),
      iconId: 'fr-icon-home-4-line',
      pressed: !queryStates.crous,
      nativeButtonProps: { onClick: toggleCrous },
      tooltip: t('tooltip.nonCrous'),
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

  return (
    <ul className="fr-tags-group fr-mb-0">
      {tags.map(({ tooltip, ...tagProps }, i) => (
        <li key={i}>
          {tooltip ? (
            <Tooltip kind="hover" title={tooltip}>
              <Tag {...tagProps} />
            </Tooltip>
          ) : (
            <Tag {...tagProps} />
          )}
        </li>
      ))}
    </ul>
  )
}
