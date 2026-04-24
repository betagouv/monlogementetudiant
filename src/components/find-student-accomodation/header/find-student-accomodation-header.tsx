'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { FC, useState } from 'react'
import { FindStudentAccomodationAutocompleteInput } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-input'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationAvailabilitySwitch } from '~/components/find-student-accomodation/header/find-student-accommodation-availability-switch'
import { FindStudentAccommodationCrousFilter } from '~/components/find-student-accomodation/header/find-student-accommodation-crous-filter'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import styles from './find-student-accomodation-header.module.css'

export const FindStudentAccomodationHeader: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const [{ accessible, colocation }] = useQueryStates({
    accessible: parseAsString,
    colocation: parseAsString,
  })
  const [showAdvanced, setShowAdvanced] = useState(() => accessible === 'true' || colocation === 'true')

  return (
    <>
      <div className="fr-hidden fr-unhidden-md">
        <div className={styles.container}>
          <div className={styles.mainRow}>
            <FindStudentAccomodationAutocompleteInput />
            <FindStudentAccommodationAvailabilitySwitch />
            <FindStudentAccommodationPrice />
            <FindStudentAccommodationCrousFilter />
            <Button
              className={styles.toggleButton}
              iconId={showAdvanced ? 'fr-icon-subtract-line' : 'fr-icon-add-line'}
              priority="secondary"
              title={t('advancedFiltersToggle')}
              onClick={() => setShowAdvanced((v) => !v)}
            />
          </div>
          {showAdvanced && (
            <div className={styles.advancedRow}>
              <FindStudentAccessibleAccomodationSwitch />
              <FindStudentColivingAccomodationSwitch />
            </div>
          )}
        </div>
      </div>
      <div className="fr-hidden-md">
        <div className={styles.mobileContainer}>
          <FindStudentAccomodationAutocompleteInput />
          <FindStudentAccommodationCrousFilter />
        </div>
      </div>
    </>
  )
}
