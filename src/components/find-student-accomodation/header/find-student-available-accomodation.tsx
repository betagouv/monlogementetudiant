'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'

export const FindStudentAvailableAccomodationSwitch: FC = () => {
  const [queryStates, setQueryStates] = useQueryStates({
    disponible: parseAsString.withDefault('true'),
    page: parseAsInteger,
  })
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()

  const handleChange = (value: boolean) => setQueryStates({ disponible: value ? 'true' : 'false', page: 1 })

  return (
    <div className={classes.container}>
      <ToggleSwitch
        classes={{ label: classes.label }}
        inputTitle="availabilty"
        showCheckedHint={false}
        label={t('header.available')}
        labelPosition="right"
        checked={queryStates.disponible === 'true'}
        onChange={handleChange}
      />
    </div>
  )
}

const useStyles = tss.create({
  container: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
  },
  label: {
    '&::before': {
      marginRight: '0.5rem !important',
    },
    width: 'unset !important',
  },
})
