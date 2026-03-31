import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CommonFooter } from '~/components/ui/footer/footer'
import { WorkspaceHeaderComponent } from '~/components/ui/header/workspace-header'
import { getServerSession } from '~/services/better-auth'
import styles from './layout.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('workspace.description'),
    title: t('workspace.title'),
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
  const session = await getServerSession()

  if (!session) {
    return notFound()
  }

  if (session.user.role === 'user') {
    redirect('/mon-espace/tableau-de-bord')
  }

  return (
    <>
      <WorkspaceHeaderComponent />
      <main className={styles.container}>{children}</main>
      <CommonFooter />
    </>
  )
}
