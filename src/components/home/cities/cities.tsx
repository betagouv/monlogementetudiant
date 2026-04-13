import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { getPopularCities } from '~/server/territories/get-popular-cities'
import styles from './cities.module.css'

export const CitiesSection = async () => {
  const tHome = await getTranslations('home')
  const popularCities = await getPopularCities()
  const sortedPopularCities = popularCities.sort((a, b) => b.nb_total_apartments - a.nb_total_apartments).slice(0, 16)

  return (
    <section className="fr-container-sm fr-pb-md-16w">
      <div className={styles.citiesSection}>
        <div className="fr-flex fr-direction-column fr-direction-md-row">
          <div className={styles.citiesIllustration}>
            <Image
              width={612}
              height={376}
              src="/images/sofa-student.svg"
              alt={tHome('cities.illustrationAlt')}
              className={styles.citiesImage}
            />
          </div>
          <div className={clsx('fr-flex fr-direction-column fr-flex-gap-6v', styles.citiesContent)}>
            <h2 className={clsx('fr-text--center fr-h2 fr-mb-0', styles.citiesTitle)}>{tHome('cities.title')}</h2>
            <div className={clsx('fr-flex fr-flex-wrap fr-flex-gap-4v', styles.citiesGrid)}>
              {sortedPopularCities.map((city) => (
                <Button
                  className={styles.cityButton}
                  linkProps={{ href: `/trouver-un-logement-etudiant/ville/${city.name}${city.majority_crous ? '?crous=true' : ''}` }}
                  key={city.id}
                  priority="secondary"
                >
                  {city.name}
                </Button>
              ))}
              <Button
                priority="tertiary"
                linkProps={{ href: '/trouver-un-logement-etudiant' }}
                iconPosition="right"
                iconId="ri-arrow-right-line"
              >
                {tHome('cities.moreButton')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
