import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { TPrepareStudentLifeAccommodationResidence } from '~/schemas/accommodations/accommodations'
import styles from './prepare-student-life-accommodation-residence.module.css'

export const PrepareStudentLifeAccommodationResidence = async ({
  nb_t1,
  nb_t1_bis,
  nb_t2,
  nb_t3,
  location,
  nb_t4,
  nb_t5,
  nb_t6,
  nb_t7_more,
}: TPrepareStudentLifeAccommodationResidence) => {
  const studioPriceTiles = [
    {
      type: 'T1',
      enabled: !!nb_t1,
    },
    {
      type: 'T1bis',
      enabled: !!nb_t1_bis,
    },
    {
      type: 'T2',
      enabled: !!nb_t2,
    },
  ]
  const priceTiles = [
    {
      type: 'T3',
      enabled: !!nb_t3,
    },
    {
      type: 'T4',
      enabled: !!nb_t4,
    },
    {
      type: 'T5',
      enabled: !!nb_t5,
    },
    {
      type: 'T6',
      enabled: !!nb_t6,
    },
    {
      type: 'T7',
      enabled: !!nb_t7_more,
    },
  ]

  return (
    <div className={styles.priceContainer}>
      <h3 style={{ margin: 0 }}>Prix moyen des loyers étudiants à {location}</h3>
      <div className={styles.accommodationsContainer}>
        <div className={styles.studioColocBorderBottom}>
          <div className={styles.mainContainer}>
            <div className={clsx(styles.studioContainer)}>
              <span className={fr.cx('ri-user-line', 'fr-text--bold')} style={{ color: fr.colors.decisions.text.mention.grey.default }}>
                STUDIO (
                {studioPriceTiles
                  .filter((tile) => tile.enabled)
                  .map((tile) => tile.type)
                  .join(' • ')}
                )
              </span>
              <div className={styles.pricesTiles}>
                {studioPriceTiles
                  .filter((tile) => tile.enabled)
                  .map((tile) => (
                    <span
                      key={tile.type}
                      style={{
                        backgroundColor: fr.colors.options.yellowTournesol._950_100.default,
                        borderRadius: '4px',
                        color: fr.colors.options.yellowTournesol.sun407moon922.default,
                        padding: '0 0.5rem',
                      }}
                      className={fr.cx('fr-text--bold')}
                    >
                      {tile.type}
                    </span>
                  ))}
              </div>
            </div>

            <div className={styles.appartmentsContainer}>
              <span className={fr.cx('ri-user-line', 'fr-text--bold')} style={{ color: fr.colors.decisions.text.mention.grey.default }}>
                Appartements (
                {priceTiles
                  .filter((tile) => tile.enabled)
                  .map((tile) => tile.type)
                  .join(' • ')}
                )
              </span>
              <div className={styles.pricesTiles}>
                {priceTiles
                  .filter((tile) => tile.enabled)
                  .map((tile) => (
                    <span
                      style={{
                        backgroundColor: fr.colors.options.yellowTournesol._950_100.default,
                        borderRadius: '4px',
                        color: fr.colors.options.yellowTournesol.sun407moon922.default,
                        padding: '0 0.5rem',
                      }}
                      className={fr.cx('fr-text--bold')}
                      key={tile.type}
                    >
                      {tile.type}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.warrantyContainer}>
          <span className={fr.cx('ri-information-line')}>Prévoir un dépôt de garantie ainsi que le versement d&apos;un premier loyer</span>
        </div>
      </div>
      <p style={{ margin: 0 }}>
        <span className={fr.cx('ri-thumb-up-line')}>
          Un <span className={fr.cx('fr-text--bold')}>plafonnement des loyers est en vigueur à {location}</span> afin de limiter les abus
        </span>
      </p>
    </div>
  )
}
