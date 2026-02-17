'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { FindStudentAccommodationCitiesAutocompleteResults } from '~/components/find-student-accomodation/home/autocomplete/find-student-accommodations-cities-autocomplete-results'
import { useSearchCities } from '~/hooks/use-search-cities'
import { trackEvent } from '~/lib/tracking'
import { TCity } from '~/schemas/territories'

export const FindStudentAccommodationCitiesAutocompleteInput: FC = () => {
  const t = useTranslations('prepareStudentLife')
  const [_, setBboxQuery] = useQueryState('bbox')
  const { classes } = useStyles()
  const { data, isError, searchQuery, searchQueryState, setSearchQuery, setSearchQueryState } = useSearchCities()

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }

  const handleOnFocus = () => {
    setSearchQuery('')
    setSearchQueryState('')
  }

  const handleOnClickItem = (item: TCity) => {
    trackEvent({ category: 'Recherche', action: 'recherche ville', name: item.name })
    const formattedBbox = `${item.bbox.xmin},${item.bbox.ymin},${item.bbox.xmax},${item.bbox.ymax}`
    setBboxQuery(formattedBbox)
    setSearchQuery(item.name)
    setSearchQueryState(item.slug)
  }

  return (
    <div className={classes.container}>
      <Input
        classes={{ root: classes.input }}
        label={t('city')}
        iconId="ri-search-line"
        nativeInputProps={{ onFocus: handleOnFocus, onChange: handleInputChange, value: searchQuery }}
        state={isError ? 'error' : 'default'}
      />

      {data && !!searchQuery && !searchQueryState && (
        <FindStudentAccommodationCitiesAutocompleteResults data={data} onClickItem={handleOnClickItem} />
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
})
