'use client'

import { FrCxArg, fr } from '@codegouvfr/react-dsfr'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories, TTerritory } from '~/schemas/territories'

interface FindStudentAccomodationAutocompleteResults {
  data: TTerritories
}

const getCategoryKeySingular = (categoryKey: keyof TTerritories) => {
  const singular = {
    academies: 'academie',
    cities: 'ville',
    departments: 'departement',
  }
  return singular[categoryKey]
}

export const FindStudentAccomodationAutocompleteResults: FC<FindStudentAccomodationAutocompleteResults> = ({ data }) => {
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()
  const currentSearchParams = useSearchParams()
  const categories = ['cities', 'academies', 'departments']

  const getCategoryLabelAndIcon = (category: keyof TTerritories): { icon: FrCxArg; label: string } => {
    const labels = {
      academies: { icon: 'ri-bank-fill' as FrCxArg, label: t('autocomplete.categories.academies') },
      cities: { icon: 'ri-community-line' as FrCxArg, label: t('autocomplete.categories.cities') },
      departments: { icon: 'fr-icon-france-line' as FrCxArg, label: t('autocomplete.categories.departments') },
    }
    return labels[category]
  }

  if (!Object.keys(data).length) {
    return null
  }

  return (
    <div className={classes.container}>
      <ul className={classes.list}>
        {categories.map((category) => {
          const categoryKey = category as keyof TTerritories
          const items = data[categoryKey] as TTerritory[]
          if (!items?.length) return null
          const { icon, label } = getCategoryLabelAndIcon(categoryKey)

          return (
            <div className={classes.category} key={category}>
              <li className={classes.categoryItem}>
                <span className={fr.cx(icon)}>{label}</span>
              </li>
              <ul className={classes.list}>
                {items.map((item: TTerritory) => {
                  const searchParams = new URLSearchParams()
                  const isAcademy = categoryKey === 'academies'

                  const paramsToPreserve = ['colocation', 'accessible', 'prix', 'crous']
                  paramsToPreserve.forEach((param) => {
                    const value = currentSearchParams.get(param)
                    if (value) searchParams.set(param, value)
                  })

                  if (!isAcademy) {
                    searchParams.set('vue', 'carte')

                    if (item.bbox) {
                      const expanded = expandBbox(item.bbox.xmin, item.bbox.ymin, item.bbox.xmax, item.bbox.ymax)
                      searchParams.set('bbox', `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
                    }
                  } else {
                    searchParams.set('academie', item.id.toString())
                  }

                  return (
                    <Link
                      key={item.id}
                      href={{
                        pathname: `/trouver-un-logement-etudiant/${getCategoryKeySingular(categoryKey)}/${item.name}`,
                        search: searchParams.toString(),
                      }}
                    >
                      <li className={classes.item} key={item.id} tabIndex={0}>
                        {item.name}
                        {'department_code' in item && item.department_code ? <>&nbsp;({item.department_code})</> : null}
                      </li>
                    </Link>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </ul>
    </div>
  )
}

const useStyles = tss.create({
  category: {
    backgroundColor: fr.colors.decisions.background.alt.beigeGrisGalet.default,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  categoryItem: {
    paddingBottom: '0.5rem',
    paddingLeft: '0.5rem',
    paddingTop: '0.5rem',
  },
  container: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    left: 0,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 10,
  },
  item: {
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
    borderBottom: '1px solid #e0e0e0',
    borderTop: '1px solid #e0e0e0',
    cursor: 'pointer',
    padding: '8px',
  },
  list: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
})
