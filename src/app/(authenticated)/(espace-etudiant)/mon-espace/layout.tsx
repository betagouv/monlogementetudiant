import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ImpersonationBanner } from '~/components/impersonation/impersonation-banner'
import { StudentSpaceNavigation } from '~/components/student-space/navigation/student-space-navigation'
import { PendingSimulationSaver } from '~/components/student-space/pending-simulation-saver'
import { StudentProfileGate } from '~/components/student-space/profile/student-profile-gate'
import { StudentBreadcrumb } from '~/components/student-space/student-breadcrumb'
import { CommonSkipLinks, MAIN_CONTENT_ID } from '~/components/ui/common-skip-links'
import { CommonFooter } from '~/components/ui/footer/footer'
import { CommonHeader } from '~/components/ui/header/common-header'
import { canAccessStudentSpace } from '~/lib/roles'
import { getServerSession } from '~/services/better-auth'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('student.workspace.description'),
    title: {
      template: `%s - ${t('student.workspace.shortTitle')}`,
      default: t('student.workspace.title'),
    },
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = await getServerSession()

  if (!auth || !canAccessStudentSpace(auth.user.role)) {
    return notFound()
  }

  return (
    <>
      <PendingSimulationSaver />
      <StudentProfileGate user={auth.user} />
      <CommonSkipLinks withNavigation={false} />
      <CommonHeader withNavigation={false} />
      <ImpersonationBanner />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="primaryBackgroundColor">
        <div className="fr-container fr-pb-12w">
          <StudentBreadcrumb />
          <div className="fr-col-md-12 fr-flex fr-direction-column fr-direction-md-row fr-background-default--grey">
            <div className="fr-border fr-col-md-4">
              <StudentSpaceNavigation />
            </div>
            <div className="fr-col-md-8">{children}</div>
          </div>
        </div>
      </main>
      <CommonFooter />
    </>
  )
}
