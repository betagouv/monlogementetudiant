import { fr } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import PrepareStudentLifeNearbyAccommodations from '~/components/prepare-student-life/nearby/prepare-student-life-nearby-accommodations'
import PrepareStudentLifeStats from '~/components/prepare-student-life/stats/prepare-student-life-stats'
import PrepareStudentLifeSummary from '~/components/prepare-student-life/summary/prepare-student-life-summary'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { getCityDetails } from '~/server-only/get-city-details'

export default async function PrepareStudentLifeCityPage({ params }: { params: { location: string } }) {
  const t = await getTranslations('prepareStudentLife')
  const { location } = params
  const cityDetails = await getCityDetails(location)
  const { bbox, name } = cityDetails

  return (
    <div>
      <div className={fr.cx('fr-container')}>
        <DynamicBreadcrumb title={name} />
        <h1>{t('title', { title: name })}</h1>
      </div>
      <PrepareStudentLifeSummary {...cityDetails} location={name} />
      <PrepareStudentLifeStats {...cityDetails} location={name} />
      <PrepareStudentLifeNearbyAccommodations bbox={bbox} name={name} />
    </div>
  )
}
