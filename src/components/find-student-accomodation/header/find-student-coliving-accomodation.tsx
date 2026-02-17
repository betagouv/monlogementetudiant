'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { trackEvent } from '~/lib/tracking'

export const FindStudentColivingAccomodationSwitch: FC = () => {
  const [queryStates, setQueryStates] = useQueryStates({
    colocation: parseAsString,
    page: parseAsInteger,
    crous: parseAsString,
  })
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()

  const handleChange = (value: boolean) => {
    trackEvent({ category: 'Recherche', action: 'filtre colocation', name: value ? 'active' : 'inactive' })
    setQueryStates({ colocation: value ? 'true' : 'false', page: 1 })
  }

  return (
    <div className={classes.container}>
      <ToggleSwitch
        classes={{ label: classes.label }}
        inputTitle="coliving"
        showCheckedHint={false}
        label={t('header.shared')}
        labelPosition="right"
        checked={queryStates.colocation === 'true'}
        onChange={handleChange}
        disabled={queryStates.crous === 'true'}
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
