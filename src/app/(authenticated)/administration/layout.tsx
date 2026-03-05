import { notFound } from 'next/navigation'
import { AdminNavigation } from '~/components/administration/admin-navigation'
import { CommonFooter } from '~/components/ui/footer/footer'
import { WorkspaceHeaderComponent } from '~/components/ui/header/workspace-header'
import { getServerSession } from '~/services/better-auth'

export const metadata = {
  title: 'Administration - Mon Logement Etudiant',
  robots: { index: false, follow: false },
}

export default async function AdministrationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession()

  if (!session || session.user.role !== 'admin') {
    return notFound()
  }

  return (
    <>
      <WorkspaceHeaderComponent />
      <main className="primaryBackgroundColor">
        <div className="fr-container fr-pb-12w">
          <div className="fr-col-md-12 fr-flex fr-direction-column fr-direction-md-row fr-background-default--grey fr-mt-3w">
            <div className="fr-border fr-col-md-3">
              <AdminNavigation />
            </div>
            <div className="fr-col-md-9 fr-p-3w">{children}</div>
          </div>
        </div>
      </main>
      <CommonFooter />
    </>
  )
}
