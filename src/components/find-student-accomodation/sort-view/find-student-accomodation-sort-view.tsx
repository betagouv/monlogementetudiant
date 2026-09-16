'use client'

import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { useLocale, useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { useAccomodations } from '~/hooks/use-accomodations'
import { trackEvent } from '~/lib/tracking'
import { TTerritory } from '~/schemas/territories'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import { sPluriel } from '~/utils/sPluriel'

type FindStudentAccomodationSortViewProps = {
  territory?: TTerritory
}
export const FindStudentAccomodationSortView: FC<FindStudentAccomodationSortViewProps> = ({ territory }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    ['recherche-par-carte']: parseAsBoolean.withDefault(false),
    vue: parseAsString.withDefault('grille'),
  })
  const t = useTranslations('findAccomodation.filters')
  const locale = useLocale()
  const { data: accommodations } = useAccomodations()

  const { classes } = useStyles({ hasResults: accommodations && accommodations.count > 0 })

  const title =
    territory?.name && !queryStates['recherche-par-carte']
      ? t('accommodationsWithLocation', {
          pluralize: sPluriel(accommodations?.count ?? 0),
          locationFormatted: formatCityWithPreposition(locale, 'à', territory.name),
        })
      : `${t('accommodations')}${sPluriel(accommodations?.count ?? 0)}`
  return (
    <div className={classes.headerContainer}>
      <div role="status" aria-live="polite">
        {accommodations && accommodations.count > 0 && (
          <h2 className="h4">
            {accommodations.count} {title}
          </h2>
        )}
      </div>
      <div className={classes.container}>
        <div className="fr-hidden fr-unhidden-md">
          <SegmentedControl
            hideLegend
            legend={t('view')}
            segments={[
              {
                label: t('grid'),
                iconId: 'ri-layout-grid-2-line',
                nativeInputProps: {
                  checked: queryStates.vue === 'grille',
                  onChange: () => {
                    trackEvent({ category: 'Recherche', action: 'changement vue', name: 'grille' })
                    setQueryStates({ vue: 'grille' })
                  },
                },
              },
              {
                label: t('map'),
                iconId: 'ri-road-map-fill',
                nativeInputProps: {
                  checked: queryStates.vue === 'carte',
                  onChange: () => {
                    trackEvent({ category: 'Recherche', action: 'changement vue', name: 'carte' })
                    setQueryStates({ vue: 'carte' })
                  },
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

const useStyles = tss.withParams<{ hasResults?: boolean }>().create(({ hasResults }) => ({
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    },
  },
  container: {
    display: 'flex',
    gap: '1rem',
  },
  headerContainer: {
    display: 'flex',
    justifyContent: hasResults ? 'space-between' : 'flex-end',
    alignItems: 'start',
  },
  title: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    height: '2.5rem',
    width: '10.5rem',
  },
}))
