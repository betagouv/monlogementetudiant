'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsInteger, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { trackEvent } from '~/lib/tracking'

type FindStudentColivingAccomodationSwitchProps = {
  widget?: boolean
}

export const FindStudentColivingAccomodationSwitch: FC<FindStudentColivingAccomodationSwitchProps> = ({ widget = false }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    colocation: parseAsBoolean,
    page: parseAsInteger,
    crous: parseAsBoolean,
  })
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()

  const handleChange = (value: boolean) => {
    trackEvent({ category: 'Recherche', action: 'filtre colocation', name: value ? 'active' : 'inactive' })
    setQueryStates({ colocation: value, page: 1 })
  }

  return (
    <ToggleSwitch
      classes={{ label: classes.label }}
      inputTitle="coliving"
      showCheckedHint={false}
      label={t('header.shared')}
      labelPosition="right"
      checked={!!queryStates.colocation}
      disabled={widget && !!queryStates.crous}
      onChange={handleChange}
    />
  )
}

const useStyles = tss.create({
  label: {
    '&::before': {
      marginRight: '0.5rem !important',
    },
    width: 'unset !important',
  },
})
