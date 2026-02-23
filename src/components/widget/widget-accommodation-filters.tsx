'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { FC, useState } from 'react'
import { tss } from 'tss-react'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationCrousFilter } from '~/components/find-student-accomodation/header/find-student-accommodation-crous-filter'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import { expandBbox } from '~/components/map/map-utils'
import { useSearchCities } from '~/hooks/use-search-cities'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import { TCity } from '~/schemas/territories'

type WidgetAccommodationFiltersProps = {
  initialCity?: string
  initialData?: TGetAccomodationsResponse
  showLocationInput: boolean
}

export const WidgetAccommodationFilters: FC<WidgetAccommodationFiltersProps> = ({ initialCity, initialData, showLocationInput }) => {
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()
  const [, setBbox] = useQueryState('bbox', parseAsString)
  const { data: cities, isError, searchQuery, setSearchQuery, searchQueryState, setSearchQueryState } = useSearchCities()
  const [showResults, setShowResults] = useState(false)

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setShowResults(true)
  }

  const handleCitySelect = (city: TCity) => {
    const expanded = expandBbox(city.bbox.xmin, city.bbox.ymin, city.bbox.xmax, city.bbox.ymax)
    setBbox(`${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
    setSearchQuery(city.name)
    setSearchQueryState(city.slug)
    setShowResults(false)
  }

  return (
    <div className={classes.container}>
      <div className={classes.locationContainer}>
        {showLocationInput && (
          <Input
            classes={{ root: classes.input }}
            label={t('header.inputLabel')}
            iconId="ri-map-pin-2-line"
            nativeInputProps={{
              onChange: handleInputChange,
              onFocus: () => {
                setShowResults(true)
                setSearchQuery('')
                setSearchQueryState('')
              },
              value: searchQuery || initialCity || '',
              placeholder: t('header.inputLabel'),
            }}
            state={isError ? 'error' : 'default'}
          />
        )}
        {showResults && cities && cities.length > 0 && !searchQueryState && (
          <div className={classes.dropdown}>
            <ul className={classes.list}>
              {cities.map((city) => (
                <li key={city.id} className={classes.dropdownItem} onClick={() => handleCitySelect(city)}>
                  {city.name} {city.department_code ? `(${city.department_code})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={classes.filtersRow}>
        <FindStudentAccommodationPrice initialData={initialData} />
        <FindStudentAccommodationCrousFilter />
        <FindStudentColivingAccomodationSwitch />
        <FindStudentAccessibleAccomodationSwitch />
      </div>
    </div>
  )
}

const useStyles = tss.create({
  container: {
    marginBottom: '1rem',
  },
  locationContainer: {
    position: 'relative',
    maxWidth: '300px',
    marginBottom: '1rem',
  },
  input: {
    marginBottom: '0 !important',
  },
  dropdown: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    left: 0,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 10,
  },
  list: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  dropdownItem: {
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
    borderBottom: '1px solid #e0e0e0',
    cursor: 'pointer',
    padding: '8px',
  },
  filtersRow: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
})
