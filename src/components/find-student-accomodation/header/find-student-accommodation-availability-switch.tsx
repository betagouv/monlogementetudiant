'use client'

import { ToggleSwitch } from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useTranslations } from 'next-intl'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { FC } from 'react'
import { trackEvent } from '~/lib/tracking'
import styles from './find-student-accommodation-availability-switch.module.css'

type FindStudentAccommodationAvailabilitySwitchProps = {
  widget?: boolean
}

export const FindStudentAccommodationAvailabilitySwitch: FC<FindStudentAccommodationAvailabilitySwitchProps> = ({ widget = false }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    disponible: parseAsString,
    page: parseAsInteger,
    crous: parseAsString,
  })
  const t = useTranslations('findAccomodation')

  const handleChange = (value: boolean) => {
    trackEvent({ category: 'Recherche', action: 'filtre disponibilites', name: value ? 'active' : 'inactive' })
    setQueryStates({ disponible: value ? 'true' : 'false', page: 1 })
  }

  return (
    <div>
      <p className="fr-label fr-mt-0 fr-mb-3v">{t('header.availabilityLegend')}</p>
      <ToggleSwitch
        className="fr-mb-2v"
        classes={{ label: styles.label }}
        inputTitle="availability"
        showCheckedHint={false}
        label={t('header.availability')}
        labelPosition="right"
        checked={queryStates.disponible === 'true'}
        disabled={widget && queryStates.crous === 'true'}
        onChange={handleChange}
      />
    </div>
  )
}
