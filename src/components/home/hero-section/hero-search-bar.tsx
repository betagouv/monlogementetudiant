'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useQueryState } from 'nuqs'
import { FC, useMemo, useState } from 'react'
import { FindStudentAccommodationCitiesAutocompleteResults } from '~/components/find-student-accomodation/home/autocomplete/find-student-accommodations-cities-autocomplete-results'
import { useSearchCities } from '~/hooks/use-search-cities'
import { trackEvent } from '~/lib/tracking'
import { TCity } from '~/schemas/territories'
import styles from './hero-search-bar.module.css'

export const HeroSearchBar: FC = () => {
  const [_, setBboxQuery] = useQueryState('bbox')
  const { data, isError, searchQuery, searchQueryState, setSearchQuery, setSearchQueryState } = useSearchCities()
  const [selectedCity, setSelectedCity] = useState<TCity | null>(null)

  const searchHref = useMemo(() => {
    if (selectedCity) {
      return `/trouver-un-logement-etudiant/ville/${encodeURIComponent(selectedCity.name)}`
    }
    if (searchQuery) {
      return `/trouver-un-logement-etudiant?q=${encodeURIComponent(searchQuery)}`
    }
    return '/trouver-un-logement-etudiant'
  }, [selectedCity, searchQuery])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setSelectedCity(null)
  }

  const handleOnFocus = () => {
    setSearchQuery('')
    setSearchQueryState('')
    setSelectedCity(null)
  }

  const handleOnClickItem = (item: TCity) => {
    trackEvent({ category: 'Recherche', action: 'recherche ville hero', name: item.name })
    const formattedBbox = `${item.bbox.xmin},${item.bbox.ymin},${item.bbox.xmax},${item.bbox.ymax}`
    setBboxQuery(formattedBbox)
    setSearchQuery(item.name)
    setSearchQueryState(item.slug)
    setSelectedCity(item)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      window.location.href = searchHref
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <div className={styles.inputContainer}>
          <Input
            classes={{ root: styles.input, nativeInputOrTextArea: styles.nativeInput }}
            label=""
            hideLabel
            nativeInputProps={{
              placeholder: 'Ville, académie ou département',
              onFocus: handleOnFocus,
              onChange: handleInputChange,
              onKeyDown: handleKeyDown,
              value: searchQuery,
            }}
            state={isError ? 'error' : 'default'}
          />
          {data && !!searchQuery && !searchQueryState && (
            <FindStudentAccommodationCitiesAutocompleteResults data={data} onClickItem={handleOnClickItem} />
          )}
        </div>
        <Button className={styles.searchButtonDesktop} iconId="ri-search-line" linkProps={{ href: searchHref }}>
          Rechercher
        </Button>
        <Button className={styles.searchButtonMobile} iconId="ri-search-line" linkProps={{ href: searchHref }}>
          {null}
        </Button>
      </div>
    </div>
  )
}
