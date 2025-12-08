'use client'
import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { tss } from 'tss-react'
import { FindStudentAccomodationAutocompleteResults } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-results'
import { useTerritories } from '~/hooks/use-territories'

export const FindStudentAccomodationAutocompleteInput: FC = () => {
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()

  const { data, isError, searchQuery, setSearchQuery } = useTerritories()
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.preventDefault()
  }

  return (
    <div className="fr-position-relative">
      <Input
        classes={{ root: classes.input }}
        label={t('header.inputLabel')}
        iconId="ri-map-pin-2-line"
        nativeInputProps={{ onBlur: handleInputBlur, onChange: handleInputChange, value: searchQuery }}
        state={isError ? 'error' : 'default'}
      />

      {data && <FindStudentAccomodationAutocompleteResults data={data} />}
    </div>
  )
}

const useStyles = tss.create({
  input: {
    marginBottom: '0 !important',
    maxWidth: '260px',
  },
})
