'use client'

import { SearchBar } from '@codegouvfr/react-dsfr/SearchBar'
import { useRouter } from 'next/navigation'
import { FC, useMemo } from 'react'
import { FindStudentAccomodationAutocompleteResults } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-results'
import { useTerritories } from '~/hooks/use-territories'
import styles from './hero-search-bar.module.css'

export const HeroSearchBar: FC = () => {
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      router.push(searchHref)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inputContainer}>
        <SearchBar
          className={styles.searchBar}
          big
          label="Rechercher"
          renderInput={({ className, id, type }) => (
            <input
              className={`${className} ${styles.nativeInput}`}
              id={id}
              type={type}
              placeholder="Ville, académie ou département"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
          )}
          onButtonClick={() => router.push(searchHref)}
        />
        {data && <FindStudentAccomodationAutocompleteResults data={data} />}
      </div>
    </div>
  )
}
