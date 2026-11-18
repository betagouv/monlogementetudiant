import Alert from '@codegouvfr/react-dsfr/Alert'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { DataVisualization } from '@codegouvfr/react-dsfr/picto'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ScholarshipSurveyForm } from '~/components/bailleur/scholarship-survey/scholarship-survey-form'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { isScholarshipSurveyActive, SCHOLARSHIP_SURVEY_SCHOOL_YEAR } from '~/server/scholarship-survey/active'
import { buildHref } from '~/utils/preserve-query-params'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ ownerId?: string }>
}

export default async function ScholarshipSurveyPage({ searchParams }: PageProps) {
  if (!isScholarshipSurveyActive()) notFound()
  const awaitedSearchParams = await searchParams
  const ctx = await getBailleurContext(awaitedSearchParams.ownerId)
  if (!ctx.hasPermission('manage_residences')) notFound()
  const t = await getTranslations('bailleur.scholarshipSurvey')

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={t('breadcrumbCurrent')}
        segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } }]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />

      <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
        <DataVisualization width={72} height={72} />
        <div>
          <h1 className="fr-mb-1v">{t('title')}</h1>
          <p className="fr-mb-0">{t('subtitle', { year: SCHOLARSHIP_SURVEY_SCHOOL_YEAR })}</p>
        </div>
      </div>

      <Alert severity="info" small={false} title={t('whyTitle')} description={t('whyDescription')} className="fr-mb-4w" />

      <ScholarshipSurveyForm
        ownerId={awaitedSearchParams.ownerId ? Number(awaitedSearchParams.ownerId) : undefined}
        schoolYear={SCHOLARSHIP_SURVEY_SCHOOL_YEAR}
      />
    </div>
  )
}
