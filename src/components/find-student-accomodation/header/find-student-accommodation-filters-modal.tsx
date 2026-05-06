'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FindStudentAccessibleAccomodationSwitch } from './find-student-accessible-accomodation-switch'
import { FindStudentAccommodationAvailabilitySwitch } from './find-student-accommodation-availability-switch'
import { FindStudentAccommodationCrousFilter } from './find-student-accommodation-crous-filter'
import styles from './find-student-accommodation-filters-modal.module.css'
import { FindStudentAccommodationPrice } from './find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from './find-student-coliving-accomodation'

export const mobileFiltersModal = createModal({
  id: 'mobile-filters-modal',
  isOpenedByDefault: false,
})

export const FindStudentAccommodationFiltersModal: FC = () => {
  const t = useTranslations('findAccomodation.header')

  return (
    <mobileFiltersModal.Component
      title={t('filtersCta')}
      buttons={[{ children: t('applyFilters'), onClick: () => mobileFiltersModal.close() }]}
    >
      <div className={styles.filters}>
        <FindStudentAccommodationCrousFilter />
        <FindStudentAccommodationAvailabilitySwitch />
        <FindStudentAccommodationPrice />
        <FindStudentAccessibleAccomodationSwitch />
        <FindStudentColivingAccomodationSwitch />
      </div>
    </mobileFiltersModal.Component>
  )
}
