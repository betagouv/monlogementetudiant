'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import clsx from 'clsx'
import { FC, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { tss } from 'tss-react'
import { useTerritories } from '~/hooks/use-territories'
import { TCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { TAcademyOrDepartment, TCity } from '~/schemas/territories'

interface StudentAlertLocationProps {
  error?: string
  initialLocation?: string
}

export const StudentAlertLocation: FC<StudentAlertLocationProps> = ({ error, initialLocation }) => {
  const { classes } = useStyles()
  const { data, isError, searchQuery, setSearchQuery } = useTerritories()
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || '')
  const [showResults, setShowResults] = useState(false)
  const { setValue } = useFormContext<TCreateAlertRequest>()

  // Update local state when initialLocation changes
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

  const handleClick = (field: 'city_id' | 'academy_id' | 'department_id', item: TCity | TAcademyOrDepartment) => {
    setSearchQuery(item.name)
    setSelectedLocation(item.name)
    setShowResults(false)
    setValue(field, item.id)
  }

  const hasResults = data && ((data.cities?.length ?? 0) > 0 || (data.departments?.length ?? 0) > 0 || (data.academies?.length ?? 0) > 0)

  return (
    <div className={classes.container}>
      <Input
        classes={{ root: classes.input }}
        label="Ville, département ou académie"
        iconId="ri-map-pin-line"
        nativeInputProps={{
          onFocus: handleOnFocus,
          onChange: handleInputChange,
          value: searchQuery,
          placeholder: 'Rechercher une ville, un département ou une académie',
        }}
        state={error || isError ? 'error' : 'default'}
        stateRelatedMessage={error}
      />

      {hasResults && showResults && !!searchQuery && !selectedLocation && (
        <div className={classes.resultsContainer}>
          <ul className={classes.list}>
            {data.cities?.map((item: TCity) => (
              <li className={classes.item} key={`city-${item.id}`} onClick={() => handleClick('city_id', item)}>
                <span className={clsx(classes.icon, 'ri-map-pin-2-fill')} />
                {item.name} ({item.department_code})
              </li>
            ))}
            {data.departments?.map((item: TAcademyOrDepartment) => (
              <li className={classes.item} key={`dept-${item.id}`} onClick={() => handleClick('department_id', item)}>
                <span className={clsx(classes.icon, 'ri-road-map-line')} />
                {item.name}
              </li>
            ))}
            {data.academies?.map((item: TAcademyOrDepartment) => (
              <li className={classes.item} key={`academy-${item.id}`} onClick={() => handleClick('academy_id', item)}>
                <span className={clsx(classes.icon, 'ri-government-line')} />
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
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
