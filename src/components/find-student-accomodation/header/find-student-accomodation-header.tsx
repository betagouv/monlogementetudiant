import { FC } from 'react'
import { FindStudentAccomodationAutocompleteInput } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-input'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationCrousFilter } from '~/components/find-student-accomodation/header/find-student-accommodation-crous-filter'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'
import styles from './find-student-accomodation-header.module.css'

type FindStudentAccomodationHeaderProps = {
  data?: TGetAccomodationsResponse
}

export const FindStudentAccomodationHeader: FC<FindStudentAccomodationHeaderProps> = async ({ data }) => {
  return (
    <>
      <div className="fr-hidden fr-unhidden-sm">
        <div className={styles.container}>
          <FindStudentAccomodationAutocompleteInput />
          <FindStudentAccommodationPrice initialData={data} />
          <FindStudentAccommodationCrousFilter />
          <FindStudentColivingAccomodationSwitch />
          <FindStudentAccessibleAccomodationSwitch />
        </div>
      </div>
      <div className="fr-hidden-sm">
        <div className={styles.mobileContainer}>
          <FindStudentAccomodationAutocompleteInput />
          <FindStudentAccommodationCrousFilter />
        </div>
      </div>
    </>
  )
}
