import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { auth } from '~/auth'
import { StudentSpaceNavigation } from '~/components/student-space/navigation/student-space-navigation'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { FooterComponent } from '~/components/ui/footer/footer'
import { HeaderComponent } from '~/components/ui/header/common-header'

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
  const session = await auth()
  if (!session || session.user.role === 'owner' || !!session.error) {
    return notFound()
  }

  return (
    <>
      <HeaderComponent withNavigation={false} />
      <main className="primaryBackgroundColor">
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
      <FooterComponent />
    </>
  )
}
