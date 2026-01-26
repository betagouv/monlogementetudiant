import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import Tabs from '@codegouvfr/react-dsfr/Tabs'
import Tag from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import PrepareStudentLifeMap from '~/components/map/prepare-student-life-map'
import { formatCityWithA, formatCityWithDe } from '~/utils/french-contraction'
import styles from './prepare-student-life-summary.module.css'

interface PrepareStudentLifeSummaryProps {
  average_income: number
  bbox: { xmax: number; xmin: number; ymax: number; ymin: number }
  location: string
  name: string
  nb_students: number
  nearby_cities: Array<{ name: string; slug: string }>
}

export default async function PrepareStudentLifeSummary({
  average_income,
  bbox,
  location,
  name,
  nb_students,
  nearby_cities,
}: PrepareStudentLifeSummaryProps) {
  const t = await getTranslations('prepareStudentLife')
  const universities = [
    'Université Paris-Est Créteil (UPEC)',
    'Institut de Formation en Ergothérapie (IFE)',
    'Institut Universitaire de Technologie de Créteil-Vitry (IUT Créteil-Vitry)',
    'Faculté de Droit',
    "École Supérieure d'Ingénieurs de Paris-Est (ESIPE)",
  ]
  const formattedBbox = `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`
  const mensualIncome = Math.round(average_income / 12)

  return (
    <div className={clsx(fr.cx('fr-container'), styles.mainContainer)}>
      <div className={clsx(fr.cx('fr-col-md-12'), styles.container)}>
        <div className={clsx(fr.cx('fr-col-md-8'), styles.mainContent)}>
          <h1 className={styles.subtitle}>{t('subTitle', { titleFormatted: formatCityWithA(name) })}</h1>
          <p>
            Aliquip reprehenderit laborum consectetur mollit aliqua magna consectetur eiusmod ad. Deserunt proident dolore non et commodo
            dolor. Culpa id aliquip do nisi mollit sunt cupidatat fugiat. Nostrud aliquip aute eu. Aliquip reprehenderit laborum consectetur
            mollit aliqua magna consectetur eiusmod ad. Deserunt proident dolore non et commodo dolor. Culpa id aliquip do nisi mollit sunt
            cupidatat fugiat. Nostrud aliquip aute eu.
          </p>
          <div className={styles.statsContainer}>
            <div className={styles.statColumn}>
              <span className={fr.cx('fr-icon-team-line')}>93000 habitants</span>
              <span className={clsx(fr.cx('fr-text--bold'), styles.statValue)}>{nb_students} étudiants</span>
            </div>
            <div className={clsx(fr.cx('fr-hidden', 'fr-unhidden-sm'), styles.statDivider)}></div>
            <div className={styles.statColumn}>
              <span className={fr.cx('ri-money-euro-circle-line')}>Revenu moyen par habitant</span>
              <span className={clsx(fr.cx('fr-text--bold'), styles.statValue)}>
                {mensualIncome} €{' '}
                <span className={fr.cx('fr-text--sm')} style={{ fontWeight: 'normal' }}>
                  / mois
                </span>
              </span>
            </div>
          </div>
          <div className={styles.tabsContainer}>
            <Tabs
              className={styles.tabs}
              tabs={[
                {
                  content: (
                    <div>
                      <p className={fr.cx('fr-text--bold')}>8 lieux d&apos;enseignement supérieur</p>
                      <div className={styles.tabsLinkContainer}>
                        {universities.map((university) => (
                          <a className={styles.tabsLink} key={university} href="#">
                            {university}
                          </a>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button priority="tertiary">3 autres</Button>
                      </div>
                    </div>
                  ),
                  isDefault: true,
                  label: 'Établissements',
                },
                {
                  content: (
                    <p>
                      Esse commodo voluptate magna magna qui irure aute irure fugiat Lorem. Consequat minim eu culpa proident nulla
                      excepteur nulla duis. Ad fugiat fugiat Lorem velit reprehenderit aliqua reprehenderit. Nisi aute qui voluptate nulla
                      duis anim cillum anim. Sit excepteur ad laboris nulla in cupidatat. Incididunt sunt eu sunt officia consequat eiusmod
                      ut. Ea exercitation nostrud ad quis. Consectetur minim consectetur laboris in cillum dolor excepteur ullamco anim.
                    </p>
                  ),
                  label: 'Transports',
                },
              ]}
            />
          </div>
        </div>
        <div className={clsx(fr.cx('fr-col-md-4'), styles.mapContainer)}>
          <div className={clsx(fr.cx('fr-hidden', 'fr-unhidden-sm'), styles.mapWrapper)}>
            <PrepareStudentLifeMap bbox={formattedBbox} />
          </div>
          <div className={styles.nearbyContainer}>
            <p>{t('nearbyCities', { titleFormattedDe: formatCityWithDe(name) })}</p>
            <div className={styles.tagContainer}>
              {nearby_cities.map((city) => (
                <Tag key={city.slug}>{city.name}</Tag>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
