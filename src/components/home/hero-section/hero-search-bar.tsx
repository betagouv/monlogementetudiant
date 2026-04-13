'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useRouter } from 'next/navigation'
import { FC, useMemo } from 'react'
import { FindStudentAccomodationAutocompleteResults } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-results'
import { useTerritories } from '~/hooks/use-territories'
import styles from './hero-search-bar.module.css'

export const HeroSearchBar: FC = () => {
  const router = useRouter()
  const { data, isError, searchQuery, setSearchQuery } = useTerritories()

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
      <div className={styles.searchBar}>
        <div className={styles.inputContainer}>
          <Input
            classes={{ root: styles.input, nativeInputOrTextArea: styles.nativeInput }}
            label=""
            hideLabel
            nativeInputProps={{
              placeholder: 'Ville, académie ou département',
              onChange: handleInputChange,
              onKeyDown: handleKeyDown,
              value: searchQuery,
            }}
            state={isError ? 'error' : 'default'}
          />
          {data && <FindStudentAccomodationAutocompleteResults data={data} />}
        </div>
        <Button className={`fr-hidden fr-unhidden-sm ${styles.searchButton}`} iconId="ri-search-line" linkProps={{ href: searchHref }}>
          Rechercher
        </Button>
        <Button className="fr-hidden-sm" iconId="ri-search-line" title="Rechercher" linkProps={{ href: searchHref }} />
      </div>
    </div>
  )
}
