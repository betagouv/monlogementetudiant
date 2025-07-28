// biome-ignore lint/suspicious/noShadowRestrictedNames: dsfr picto name
import { Error, SelfTraining } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import classes from './accommodation-availability.module.css'
import styles from './accommodation-residence.module.css'

type AccommodationAvailabilityProps = {
  nbAvailable: number | null
}

export const AccommodationAvailability = async ({ nbAvailable }: AccommodationAvailabilityProps) => {
  const t = await getTranslations('accomodation.availability')

  if (nbAvailable === 0) {
    return (
      <div className={styles.section}>
        <div className={classes.mainContainer}>
          <div className={clsx('fr-py-4w fr-px-5w', classes.cardContainer)}>
            <div>
              <Error fontSize="large" width="62px" height="62px" />
            </div>
            <div className={classes.cardContent}>
              <h4 className="fr-mb-1w fr-h5">{t('noAvailabilityTitle')}</h4>
              <p className="fr-mb-1w">{t('noAvailabilityDescription')}</p>
            </div>
          </div>
          <div className={clsx('fr-py-4w fr-px-5w', classes.cardContainer, classes.maximiseChancesContainer)}>
            <div>
              <SelfTraining fontSize="large" width="62px" height="62px" className="fr-artwork--blue-ecume" />
            </div>
            <div className={classes.cardContent}>
              <h4 className="fr-mb-1w fr-h5">{t('maximiseChancesTitle')}</h4>
              <p className="fr-mb-1w">{t('maximiseChancesDescription')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
