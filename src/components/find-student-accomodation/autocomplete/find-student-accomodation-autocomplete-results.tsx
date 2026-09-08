'use client'

import { FrCxArg, fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import { LiveRegion } from '~/components/ui/live-region'
import { TTerritories, TTerritory } from '~/schemas/territories'
import { useTRPCClient } from '~/server/trpc/client'

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
  const trpcClient = useTRPCClient()
  const categories = ['cities', 'academies', 'departments']

  const trackTerritorySelection = (categoryKey: keyof TTerritories, item: TTerritory) => {
    if (categoryKey === 'cities') {
      trpcClient.tracking.logSearch.mutate({ type: 'city', id: item.id }).catch(() => undefined)
    } else if (categoryKey === 'departments') {
      trpcClient.tracking.logSearch.mutate({ type: 'department', id: item.id }).catch(() => undefined)
    }
  }

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

  const suggestionsCount = categories.reduce(
    (total, category) => total + ((data[category as keyof TTerritories] as TTerritory[])?.length ?? 0),
    0,
  )

  return (
    <div className={classes.container} role="region" aria-label={t('autocomplete.suggestionsLabel')}>
      <LiveRegion message={suggestionsCount > 0 ? t('autocomplete.suggestionsCount', { count: suggestionsCount }) : ''} />
      <ul className={classes.list}>
        {categories.map((category) => {
          const categoryKey = category as keyof TTerritories
          const items = data[categoryKey] as TTerritory[]
          if (!items?.length) return null
          const { icon, label } = getCategoryLabelAndIcon(categoryKey)

          return (
            <li className={classes.category} key={category}>
              <span className={clsx(icon, classes.categoryItem)}>{label}</span>
              <ul className={classes.list}>
                {items.map((item: TTerritory) => {
                  const searchParams = new URLSearchParams()
                  const isAcademy = categoryKey === 'academies'

                  const paramsToPreserve = ['colocation', 'accessible', 'prix', 'crous', 'disponible']
                  paramsToPreserve.forEach((param) => {
                    const value = currentSearchParams.get(param)
                    if (value) searchParams.set(param, value)
                  })

                  if (isAcademy) {
                    searchParams.set('academie', item.id.toString())
                  }
                  return (
                    <li className={classes.item} key={item.id}>
                      <Link
                        className={classes.itemLink}
                        role="option"
                        href={{
                          pathname: `/trouver-un-logement-etudiant/${getCategoryKeySingular(categoryKey)}/${item.slug}`,
                          search: searchParams.toString(),
                        }}
                        onClick={() => trackTerritorySelection(categoryKey, item)}
                      >
                        {item.name}
                        {'departmentCode' in item && item.departmentCode ? <>&nbsp;({item.departmentCode})</> : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
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
    textAlign: 'start',
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
  },
  itemLink: {
    backgroundImage: 'none',
    color: 'inherit',
    display: 'block',
    padding: '8px',
    textDecoration: 'none',
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
