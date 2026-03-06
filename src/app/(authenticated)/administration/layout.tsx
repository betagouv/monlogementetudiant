import { redirect } from 'next/navigation'
import { AdminHeaderComponent } from '~/components/administration/admin-header'
import { AdminNavigation } from '~/components/administration/admin-navigation'
import { CommonFooter } from '~/components/ui/footer/footer'
import { getServerSession } from '~/services/better-auth'
import styles from './administration.module.css'

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
      <AdminHeaderComponent />
      <main className="fr-flex">
        <AdminNavigation />
        <div className={styles.content}>{children}</div>
      </main>
      <CommonFooter />
    </>
  )
}
