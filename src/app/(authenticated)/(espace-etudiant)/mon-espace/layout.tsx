import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getServerSession } from '~/auth'
import { StudentSpaceNavigation } from '~/components/student-space/navigation/student-space-navigation'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { CommonFooter } from '~/components/ui/footer/footer'
import { CommonHeader } from '~/components/ui/header/common-header'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('student.workspace.description'),
    title: t('student.workspace.title'),
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

  if (!auth || !auth.session || !auth.user || auth.user.role === 'owner') {
    return notFound()
  }

  return (
    <>
      <a className="fr-link fr-sr-only fr-sr-only-focusable" href="#main-content">
        Aller au contenu principal
      </a>
      <CommonHeader withNavigation={false} />
      <main id="main-content" className="primaryBackgroundColor">
        <div className="fr-container fr-pb-12w">
          <DynamicBreadcrumb color="white" />
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
