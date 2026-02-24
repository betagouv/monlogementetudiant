'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { trackEvent } from '~/lib/tracking'

type FindStudentColivingAccomodationSwitchProps = {
  widget?: boolean
}

export const FindStudentColivingAccomodationSwitch: FC<FindStudentColivingAccomodationSwitchProps> = ({ widget = false }) => {
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
        disabled={widget && queryStates.crous === 'true'}
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
