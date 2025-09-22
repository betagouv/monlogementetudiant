import { fr } from '@codegouvfr/react-dsfr'
import { FC } from 'react'
import { FindStudentAccomodationAutocompleteInput } from '~/components/find-student-accomodation/autocomplete/find-student-accomodation-autocomplete-input'
import { FindStudentAccessibleAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-accessible-accomodation-switch'
import { FindStudentAccommodationPrice } from '~/components/find-student-accomodation/header/find-student-accommodation-price'
import { FindStudentColivingAccomodationSwitch } from '~/components/find-student-accomodation/header/find-student-coliving-accomodation'
import styles from './find-student-accomodation-header.module.css'

export const FindStudentAccomodationHeader: FC = async () => {
  return (
    <>
      <div className={fr.cx('fr-hidden', 'fr-unhidden-sm')}>
        <div className={styles.container}>
          <FindStudentAccomodationAutocompleteInput />
          <FindStudentAccommodationPrice />
          <FindStudentColivingAccomodationSwitch />
          <FindStudentAccessibleAccomodationSwitch />
          {/* Remove since we do not use it for now */}
          {/* <Button priority="secondary" iconId="ri-equalizer-line">
            {t('header.filtersCta')}
          </Button> */}
        </div>
      </div>
      <div className={fr.cx('fr-hidden-sm')}>
        <div className={styles.mobileContainer}>
          <FindStudentAccomodationAutocompleteInput />
          {/* Remove since we do not use it for now */}
          {/* <Button priority="secondary" iconId="ri-equalizer-line" title={t('header.filtersCta')} /> */}
        </div>
      </div>
    </>
  )
}
