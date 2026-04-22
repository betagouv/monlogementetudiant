import { notFound, redirect } from 'next/navigation'
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

  if (!session) {
    redirect('/administration/se-connecter')
  }

  if (session.user.role !== 'admin') {
    notFound()
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
