'use client'

import { SearchBar } from '@codegouvfr/react-dsfr/SearchBar'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC, useMemo } from 'react'
import { FindStudentAccomodationAutocompleteResults } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-results'
import { GeolocationButton } from '~/components/find-student-accomodation/geolocation-button'
import { useGeolocatedSearch } from '~/hooks/use-geolocated-search'
import { useTerritories } from '~/hooks/use-territories'
import styles from './hero-search-bar.module.css'

export const HeroSearchBar: FC = () => {
  const t = useTranslations()
  const router = useRouter()
  const { data, searchQuery, setSearchQuery } = useTerritories()

  const searchHref = useMemo(() => {
    if (searchQuery) {
      return `/trouver-un-logement-etudiant?q=${encodeURIComponent(searchQuery)}`
    }
    return '/trouver-un-logement-etudiant'
  }, [searchQuery])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }

  const { locate, isLocating } = useGeolocatedSearch()

  return (
    <div className={styles.container}>
      <div className={styles.inputContainer}>
        <SearchBar
          className={styles.searchBar}
          big
          allowEmptySearch
          label={t('home.features.findAccommodation.searchButton')}
          renderInput={({ className, id, type }) => (
            <input
              className={clsx(className, styles.nativeInput)}
              id={id}
              type={type}
              placeholder={t('findAccomodation.header.inputLabel')}
              value={searchQuery}
              onChange={handleInputChange}
            />
          )}
          onButtonClick={() => router.push(searchHref)}
        />
        {data && <FindStudentAccomodationAutocompleteResults data={data} />}
      </div>
      <GeolocationButton onClick={locate} isLocating={isLocating} className="fr-mt-1w" />
    </div>
  )
}
