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
    <ToggleSwitch
      classes={{ label: classes.label }}
      inputTitle="accessibility"
      showCheckedHint={false}
      label={
        <span className={classes.labelContent}>
          {t('header.accessbility')}
          <Tooltip kind="hover" title={t('header.tooltip.accessible')} />
        </span>
      }
      labelPosition="right"
      checked={queryStates.accessible === 'true'}
      onChange={handleChange}
      disabled={widget && queryStates.crous === 'true'}
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
  labelContent: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '0.5rem',
  },
})
