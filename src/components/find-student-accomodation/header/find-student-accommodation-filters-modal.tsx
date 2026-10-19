'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FindStudentAccommodationAvailabilitySwitch } from './find-student-accommodation-availability-switch'
import styles from './find-student-accommodation-filters-modal.module.css'
import { FindStudentAccommodationPriceRange } from './find-student-accommodation-price-range'
import { FindStudentAccommodationTypeTags } from './find-student-accommodation-type-tags'

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
        <FindStudentAccommodationAvailabilitySwitch />
        <FindStudentAccommodationPriceRange />
        <FindStudentAccommodationTypeTags />
      </div>
    </mobileFiltersModal.Component>
  )
}
