import { getTranslations } from 'next-intl/server'
import { SupportTicketForm } from '~/components/student-space/support/support-ticket-form'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('reportProblem.title') }
}

export default async function ReportProblemPage() {
  const t = await getTranslations('student.reportProblem')

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>{t('title')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('subtitle')}</span>
      </div>
      <div className="fr-px-6w fr-py-5w">
        <SupportTicketForm />
      </div>
    </>
  )
}
