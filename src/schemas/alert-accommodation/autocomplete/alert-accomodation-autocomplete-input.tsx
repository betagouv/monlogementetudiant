'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { FC, useState } from 'react'
import { FormState } from 'react-hook-form'
import { tss } from 'tss-react'
import { useTerritories } from '~/hooks/use-territories'
import { AlertAccomodationAutocompleteResults } from '~/schemas/alert-accommodation/autocomplete/alert-accomodation-autocomplete-results'

export const AlertAccomodationAutocompleteInput: FC<{
  formState: FormState<{
    email: string
    territory_name: string
    territory_type: string
  }>
}> = ({ formState }) => {
  const [_queryStates] = useQueryStates({ q: parseAsString, type: parseAsString })

  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const { data, isError, searchQuery, setSearchQuery } = useTerritories()
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.preventDefault()
    setOpen(true)
  }
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)
  const handleOnClick = (value: string) => {
    setSearchQuery(value)
    setOpen(false)
  }

  return (
    <div className={classes.container}>
      <Input
        classes={{ root: classes.input }}
        label={
          <div className={classes.labelContainer}>
            {t('header.inputLabel')}
            <span className={classes.asterisk}>*</span>
          </div>
        }
        iconId="ri-map-pin-2-line"
        nativeInputProps={{ onChange: handleInputChange, onFocus: handleInputFocus, value: searchQuery }}
        state={isError ? 'error' : 'default'}
        stateRelatedMessage={formState.errors.territory_name?.message}
      />

      {open && data && <AlertAccomodationAutocompleteResults onClick={handleOnClick} data={data} searchQuery={searchQuery} />}
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
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  asterisk: {
    color: 'red',
  },
})
