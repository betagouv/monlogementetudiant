'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, useQueryStates } from 'nuqs'
import { FC, useState } from 'react'
import { FindStudentAccomodationAutocompleteInput } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-input'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationActiveFilters } from '~/components/find-student-accomodation/header/find-student-accommodation-active-filters'
import { FindStudentAccommodationAvailabilitySwitch } from '~/components/find-student-accomodation/header/find-student-accommodation-availability-switch'
import { FindStudentAccommodationCrousFilter } from '~/components/find-student-accomodation/header/find-student-accommodation-crous-filter'
import {
  FindStudentAccommodationFiltersModal,
  mobileFiltersModal,
} from '~/components/find-student-accomodation/header/find-student-accommodation-filters-modal'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import styles from './find-student-accomodation-header.module.css'

export const FindStudentAccomodationHeader: FC = () => {
  const t = useTranslations('findAccomodation.header')
  const [{ accessible, colocation }] = useQueryStates({
    accessible: parseAsBoolean,
    colocation: parseAsBoolean,
  })
  const [showAdvanced, setShowAdvanced] = useState(() => !!accessible || !!colocation)

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
          <div className={styles.mobileRow}>
            <FindStudentAccomodationAutocompleteInput />
            <Button iconId="ri-equalizer-line" priority="secondary" title={t('filtersCta')} {...mobileFiltersModal.buttonProps} />
          </div>
          <FindStudentAccommodationActiveFilters />
        </div>
        <FindStudentAccommodationFiltersModal />
      </div>
    </>
  )
}
