'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { tss } from 'tss-react'
import { LiveRegion } from '~/components/ui/live-region'
import { useCombobox } from '~/hooks/use-combobox'
import { useTerritories } from '~/hooks/use-territories'
import { TCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { TAcademyOrDepartment, TCity } from '~/schemas/territories'

interface StudentAlertLocationProps {
  error?: string
  initialLocation?: string
}

export const StudentAlertLocation: FC<StudentAlertLocationProps> = ({ error, initialLocation }) => {
  const t = useTranslations('student.alerts')
  const { classes } = useStyles()
  const { data, isError, searchQuery, setSearchQuery } = useTerritories()
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || '')
  const [showResults, setShowResults] = useState(false)
  const { setValue } = useFormContext<TCreateAlertRequest>()

  useEffect(() => {
    setSelectedLocation(initialLocation || '')
    setSearchQuery(initialLocation || '')
  }, [initialLocation, setSearchQuery])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setShowResults(true)
    setSelectedLocation('')
  }

  const handleOnFocus = () => {
    if (!selectedLocation) {
      setSearchQuery('')
      setShowResults(true)
    }
  }

  const handleClick = (field: 'cityId' | 'academyId' | 'departmentId', item: TCity | TAcademyOrDepartment) => {
    setSearchQuery(item.name)
    setSelectedLocation(item.name)
    setShowResults(false)
    setValue(field, item.id)
  }

  // Les trois listes (villes, départements, académies) sont aplaties en une seule séquence :
  // le motif combobox exige un ordre unique de parcours au clavier (RGAA 7.3).
  const suggestions: TLocationSuggestion[] = [
    ...(data?.cities ?? []).map((item: TCity) => ({
      field: 'cityId' as const,
      item,
      icon: 'ri-map-pin-2-fill',
      label: `${item.name} (${item.departmentCode})`,
    })),
    ...(data?.departments ?? []).map((item: TAcademyOrDepartment) => ({
      field: 'departmentId' as const,
      item,
      icon: 'ri-road-map-line',
      label: item.name,
    })),
    ...(data?.academies ?? []).map((item: TAcademyOrDepartment) => ({
      field: 'academyId' as const,
      item,
      icon: 'ri-government-line',
      label: item.name,
    })),
  ]

  const isOpen = suggestions.length > 0 && showResults && !!searchQuery && !selectedLocation
  const { inputProps, listboxProps, getOptionProps, activeIndex, announcement } = useCombobox<TLocationSuggestion>({
    id: 'alerte-localisation',
    items: suggestions,
    isOpen,
    onSelect: (suggestion) => handleClick(suggestion.field, suggestion.item),
    onClose: () => setShowResults(false),
  })

  return (
    <div className={classes.container}>
      <Input
        classes={{ root: classes.input }}
        label={t('locationLabel')}
        hintText={t('locationHint')}
        iconId="ri-map-pin-line"
        nativeInputProps={{
          onFocus: handleOnFocus,
          onChange: handleInputChange,
          value: searchQuery,
          autoComplete: 'address-level2',
          ...inputProps,
        }}
        state={error || isError ? 'error' : 'default'}
        stateRelatedMessage={error}
      />

      <LiveRegion message={announcement} />

      {isOpen && (
        <div className={classes.resultsContainer}>
          <ul className={classes.list} {...listboxProps}>
            {suggestions.map((suggestion, index) => (
              <li
                className={clsx(classes.item, index === activeIndex && classes.itemActive)}
                key={`${suggestion.field}-${suggestion.item.id}`}
                {...getOptionProps(index)}
              >
                <span className={clsx(classes.icon, suggestion.icon)} aria-hidden="true" />
                {suggestion.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type TLocationSuggestion = {
  field: 'cityId' | 'academyId' | 'departmentId'
  item: TCity | TAcademyOrDepartment
  icon: string
  label: string
}

const useStyles = tss.create({
  container: {
    position: 'relative',
    [fr.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  input: {
    marginBottom: '0 !important',
  },
  resultsContainer: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    left: 0,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 10,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  item: {
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
    borderBottom: '1px solid #e0e0e0',
    cursor: 'pointer',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  itemActive: {
    backgroundColor: '#f0f0f0',
  },
  list: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  icon: {
    fontSize: '1rem',
    color: fr.colors.decisions.text.mention.grey.default,
  },
})
