'use client'

import { FrCxArg, fr } from '@codegouvfr/react-dsfr'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { useFormContext } from 'react-hook-form'
import { tss } from 'tss-react'
import { TTerritories, TTerritory } from '~/schemas/territories'

interface AlertAccomodationAutocompleteResults {
  data: TTerritories
  onClick: (name: string) => void
  searchQuery: string
}

interface AlertAccomodationAutocompleteItemProps {
  categoryKey: keyof TTerritories
  item: TTerritory
  onClick: (name: string) => void
}

export const AlertAccommodationResultsItem: FC<AlertAccomodationAutocompleteItemProps> = ({ categoryKey, item, onClick }) => {
  const [_, setQueryStates] = useQueryStates({ q: parseAsString, type: parseAsString })

  const { classes } = useStyles()
  const { setValue } = useFormContext()

  const getCategoryKeySingular = (categoryKey: keyof TTerritories) => {
    const singular = {
      academies: 'academy',
      cities: 'city',
      departments: 'department',
    }
    return singular[categoryKey]
  }

  return (
    <li className={classes.item} key={item.id}>
      <button
        type="button"
        className={classes.itemButton}
        onClick={() => {
          setQueryStates({ q: item.name, type: getCategoryKeySingular(categoryKey) })
          setValue('territory_name', item.name)
          setValue('territory_type', getCategoryKeySingular(categoryKey))
          onClick(item.name)
        }}
      >
        {item.name}
      </button>
    </li>
  )
}

export const AlertAccomodationAutocompleteResults: FC<AlertAccomodationAutocompleteResults> = ({ data, onClick, searchQuery }) => {
  const t = useTranslations('findAccomodation')
  const [searchQueryState] = useQueryState('q')
  const { classes } = useStyles()
  const categories = ['academies', 'cities', 'departments']

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
      {searchQueryState !== searchQuery && (
        <ul className={classes.list}>
          {categories.map((category) => {
            const categoryKey = category as keyof TTerritories
            const items = data[categoryKey] as TTerritory[]
            if (!items?.length) return null
            const { icon, label } = getCategoryLabelAndIcon(categoryKey)

            return (
              <li className={classes.category} key={category}>
                <div className={classes.categoryItem}>
                  <span className={fr.cx(icon)}>{label}</span>
                </div>
                <ul className={classes.list}>
                  {items.map((item: TTerritory) => (
                    <AlertAccommodationResultsItem onClick={onClick} key={item.id} categoryKey={categoryKey} item={item} />
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
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
    padding: '8px',
  },
  itemButton: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    display: 'block',
    padding: 0,
    textAlign: 'left',
    width: '100%',
  },
  list: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
})
