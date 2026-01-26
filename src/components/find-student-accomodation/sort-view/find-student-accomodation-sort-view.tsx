'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { TTerritory } from '~/schemas/territories'
import { formatCityWithA } from '~/utils/french-contraction'
import { sPluriel } from '~/utils/sPluriel'

type FindStudentAccomodationSortViewProps = {
  data: TGetAccomodationsResponse
  territory?: TTerritory
}
export const FindStudentAccomodationSortView: FC<FindStudentAccomodationSortViewProps> = ({ data, territory }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    ['recherche-par-carte']: parseAsBoolean.withDefault(false),
    vue: parseAsString.withDefault('grille'),
  })
  const t = useTranslations('findAccomodation.filters')
  const { data: accommodations } = useAccomodations({ initialData: data })

  const { classes } = useStyles({ hasResults: accommodations && accommodations.count > 0 })

  const title =
    territory?.name && !queryStates['recherche-par-carte']
      ? t('accommodationsWithLocation', {
          pluralize: sPluriel(accommodations?.count ?? 0),
          locationFormatted: formatCityWithA(territory.name),
        })
      : `${t('accommodations')}${sPluriel(accommodations?.count ?? 0)}`
  return (
    <div className={classes.headerContainer}>
      {accommodations && accommodations.count > 0 && (
        <h2 className="h4">
          {accommodations.count} {title}
        </h2>
      )}
      <div className={classes.container}>
        {/* Implement it as soon as we have differents sorting strategies */}
        {/* <Select label="" nativeSelectProps={{}}>
          <option disabled hidden defaultValue={t('sortByPrice')} selected>
            {t('sortByPrice')}
          </option>
        </Select> */}
        <div className={fr.cx('fr-hidden', 'fr-unhidden-md')}>
          <div>
            <Button
              iconId="ri-layout-grid-2-line"
              priority={queryStates.vue === 'grille' ? 'secondary' : 'tertiary'}
              className={classes.button}
              onClick={() => setQueryStates({ vue: 'grille' })}
            >
              {t('grid')}
            </Button>
            <Button
              iconId="ri-road-map-fill"
              priority={queryStates.vue === 'carte' ? 'secondary' : 'tertiary'}
              className={classes.button}
              onClick={() => setQueryStates({ vue: 'carte' })}
            >
              {t('map')}
            </Button>
          </div>
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
  button: {
    borderRadius: '0.25rem',
  },
  container: {
    display: 'flex',
    gap: '1rem',
  },
  headerContainer: {
    display: 'flex',
    justifyContent: hasResults ? 'space-between' : 'flex-end',
  },
  title: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    height: '2.5rem',
    width: '10.5rem',
  },
}))
