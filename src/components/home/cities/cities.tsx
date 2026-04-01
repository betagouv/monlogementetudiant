import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { getPopularCities } from '~/server/territories/get-popular-cities'
import styles from './cities.module.css'

export const CitiesSection = async () => {
  const tHome = await getTranslations('home')
  const popularCities = await getPopularCities()
  const sortedPopularCities = popularCities.sort((a, b) => b.nb_total_apartments - a.nb_total_apartments).slice(0, 16)

  return (
    <section className={clsx('fr-container', 'fr-pl-0 fr-pr-0', styles.citiesSection)}>
      <div className={styles.citiesSectionContent}>
        <div className={styles.citiesIllustration}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sofa-student.svg" alt={tHome('cities.illustrationAlt')} className={styles.citiesImage} />
        </div>
        <div className={styles.citiesContent}>
          <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('cities.title')}</h2>
          <div className={styles.citiesGrid}>
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
    </section>
  )
}
