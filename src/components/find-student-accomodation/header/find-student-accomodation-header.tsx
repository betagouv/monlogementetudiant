'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FindStudentAccomodationAutocompleteInput } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-input'
import { FindStudentAccommodationActiveFilters } from '~/components/find-student-accomodation/header/find-student-accommodation-active-filters'
import { FindStudentAccommodationAvailabilitySwitch } from '~/components/find-student-accomodation/header/find-student-accommodation-availability-switch'
import {
  FindStudentAccommodationFiltersModal,
  mobileFiltersModal,
} from '~/components/find-student-accomodation/header/find-student-accommodation-filters-modal'
import { FindStudentAccommodationPriceRange } from '~/components/find-student-accomodation/header/find-student-accommodation-price-range'
import { FindStudentAccommodationTypeTags } from '~/components/find-student-accomodation/header/find-student-accommodation-type-tags'
import styles from './find-student-accomodation-header.module.css'

export const FindStudentAccomodationHeader: FC = () => {
  const t = useTranslations('findAccomodation.header')

  return (
    <>
      <div className="fr-hidden fr-unhidden-md">
        <div className={styles.container}>
          <div className={styles.mainRow}>
            <FindStudentAccomodationAutocompleteInput />
            <FindStudentAccommodationAvailabilitySwitch />
            <FindStudentAccommodationPriceRange />
          </div>
          <FindStudentAccommodationTypeTags />
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
