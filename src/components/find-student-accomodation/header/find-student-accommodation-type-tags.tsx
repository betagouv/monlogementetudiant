'use client'

import { Tag, type TagProps } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, useQueryStates } from 'nuqs'
import { FC, MouseEvent, useId } from 'react'
import { trackEvent } from '~/lib/tracking'
import styles from './find-student-accommodation-type-tags.module.css'

export const FindStudentAccommodationTypeTags: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const id = useId()
  const crousTooltipId = `tooltip-crous-tag-${id}`
  const nonCrousTooltipId = `tooltip-non-crous-tag-${id}`
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
  const toggleCrous = (e: MouseEvent<HTMLButtonElement>) => {
    toggle('crous', 'filtre crous')()
    // Un clic souris donne le focus au bouton, ce qui garde l'infobulle DSFR ouverte.
    if (e.detail > 0) e.currentTarget.blur()
  }

  const tags: (TagProps & { tooltip?: { id: string; title: string } })[] = [
    {
      children: t('crousTag'),
      iconId: 'fr-icon-building-line',
      pressed: !!queryStates.crous,
      nativeButtonProps: { onClick: toggleCrous, 'aria-describedby': crousTooltipId },
      tooltip: { id: crousTooltipId, title: t('tooltip.crous') },
    },
    {
      children: t('nonCrousTag'),
      iconId: 'fr-icon-home-4-line',
      pressed: !queryStates.crous,
      nativeButtonProps: { onClick: toggleCrous, 'aria-describedby': nonCrousTooltipId },
      tooltip: { id: nonCrousTooltipId, title: t('tooltip.nonCrous') },
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
          <Tag {...tagProps} />
          {tooltip && (
            <span className={clsx(styles.tooltip, 'fr-tooltip fr-placement')} id={tooltip.id} role="tooltip">
              {tooltip.title}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
