'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { trackEvent } from '~/lib/tracking'

type FindStudentAccessibleAccomodationSwitchProps = {
  widget?: boolean
}

export const FindStudentAccessibleAccomodationSwitch: FC<FindStudentAccessibleAccomodationSwitchProps> = ({ widget = false }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    accessible: parseAsString,
    page: parseAsInteger,
    crous: parseAsString,
  })
  const t = useTranslations('findAccomodation')
  const { classes } = useStyles()

  const handleChange = (value: boolean) => {
    trackEvent({ category: 'Recherche', action: 'filtre accessible', name: value ? 'active' : 'inactive' })
    setQueryStates({ accessible: value ? 'true' : 'false', page: 1 })
  }

  return (
    <div className={classes.container}>
      <ToggleSwitch
        classes={{ label: classes.label }}
        inputTitle="accessibility"
        showCheckedHint={false}
        label={t('header.accessbility')}
        labelPosition="right"
        checked={queryStates.accessible === 'true'}
        onChange={handleChange}
        disabled={widget && queryStates.crous === 'true'}
      />
      <Tooltip kind="hover" title={t('header.tooltip.accessible')} />
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
