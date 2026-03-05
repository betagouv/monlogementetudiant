import { redirect } from 'next/navigation'
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
    redirect('/administration/se-connecter')
  }

  return (
    <>
      <WorkspaceHeaderComponent />
      <main className="primaryBackgroundColor" style={{ minHeight: '80vh' }}>
        <div className="fr-container fr-py-4w">
          <div
            className="fr-flex fr-direction-column fr-direction-md-row"
            style={{
              background: 'var(--background-default-grey)',
              borderRadius: '8px',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              className="fr-col-md-3"
              style={{
                borderRight: '1px solid var(--border-default-grey)',
                minWidth: '240px',
              }}
            >
              <AdminNavigation />
            </div>
            <div className="fr-col-md-9 fr-p-4w" style={{ flex: 1, minWidth: 0 }}>
              {children}
            </div>
          </div>
        </div>
      </main>
      <CommonFooter />
    </>
  )
}
