import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { SavedSimulationResults } from '~/components/student-space/housing-aid/saved-simulation-results'
import { getHousingAidSimulation } from '~/server/student/get-housing-aid-simulation'
import styles from '../mon-espace.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('housingAid.title') }
}

export default async function HousingAidPage() {
  const t = await getTranslations('student.housingAid')
  const inputs = await getHousingAidSimulation()

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-2w fr-px-md-6w fr-py-5w">
        <h1>{t('title')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('description')}</span>
      </div>
      <div className={clsx(styles.summaryContainer, 'fr-px-2w fr-px-md-6w fr-py-5w')}>
        <SavedSimulationResults inputs={inputs} />
      </div>
    </>
  )
}
