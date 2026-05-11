'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC, useState } from 'react'
import { tss } from 'tss-react'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationAvailabilitySwitch } from '~/components/find-student-accomodation/header/find-student-accommodation-availability-switch'
import { FindStudentAccommodationCrousFilter } from '~/components/find-student-accomodation/header/find-student-accommodation-crous-filter'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import { WidgetFilterKey } from '~/components/widget/widget-filters'
import { useSearchCities } from '~/hooks/use-search-cities'
import { TCity } from '~/schemas/territories'

type WidgetAccommodationFiltersProps = {
  initialCity?: string
  showLocationInput: boolean
  visibleFilters: WidgetFilterKey[]
}

export const WidgetAccommodationFilters: FC<WidgetAccommodationFiltersProps> = ({ initialCity, showLocationInput, visibleFilters }) => {
  const t = useTranslations('findAccomodation')
  const tHeader = useTranslations('findAccomodation.header')
  const { classes } = useStyles()
  const [, setLocationQueryStates] = useQueryStates({
    city: parseAsString,
    page: parseAsInteger,
  })
  const { data: cities, isError, searchQuery, setSearchQuery, searchQueryState, setSearchQueryState } = useSearchCities()
  const [showResults, setShowResults] = useState(false)

  const [{ accessible, colocation }] = useQueryStates({
    accessible: parseAsString,
    colocation: parseAsString,
  })

  const hasAdvancedFilters = visibleFilters.includes('accessible') || visibleFilters.includes('colocation')
  const [showAdvanced, setShowAdvanced] = useState(() => accessible === 'true' || colocation === 'true')

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setShowResults(true)
  }

  const handleCitySelect = (city: TCity) => {
    setLocationQueryStates({ city: city.slug, page: 1 })
    setSearchQuery(city.name)
    setSearchQueryState(city.slug)
    setShowResults(false)
  }

  return (
    <div className={classes.container}>
      <div className={classes.mainRow}>
        {showLocationInput && visibleFilters.includes('ville') && (
          <div className={classes.locationCell}>
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
        )}
        {visibleFilters.includes('disponibilites') && <FindStudentAccommodationAvailabilitySwitch widget />}
        {visibleFilters.includes('prix') && <FindStudentAccommodationPrice pageSize={6} widget />}
        {visibleFilters.includes('crous') && <FindStudentAccommodationCrousFilter />}
        {hasAdvancedFilters && (
          <Button className={classes.toggleButton} priority="tertiary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? tHeader('advancedFiltersHide') : tHeader('advancedFiltersShow')}
          </Button>
        )}
      </div>

      {hasAdvancedFilters && showAdvanced && (
        <div className={classes.advancedRow}>
          {visibleFilters.includes('accessible') && <FindStudentAccessibleAccomodationSwitch widget />}
          {visibleFilters.includes('colocation') && <FindStudentColivingAccomodationSwitch widget />}
        </div>
      )}
    </div>
  )
}

const useStyles = tss.create({
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr) auto',
    rowGap: '2rem',
    columnGap: '1rem',
    marginBottom: '1rem',
  },
  mainRow: {
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    gridColumn: '1 / -1',
    alignItems: 'start',
    justifyItems: 'start',
  },
  advancedRow: {
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    gridColumn: '1 / -1',
    alignItems: 'center',
    justifyItems: 'start',
  },
  locationCell: {
    position: 'relative',
  },
  toggleButton: {
    alignSelf: 'end',
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
})
