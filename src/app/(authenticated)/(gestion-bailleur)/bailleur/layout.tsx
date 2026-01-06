import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '~/auth'
import { CommonFooter } from '~/components/ui/footer/footer'
import { WorkspaceHeaderComponent } from '~/components/ui/header/workspace-header'
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
  const session = await auth()
  if (!session || session.user.role === 'user' || !!session.error) {
    return notFound()
  }

  return (
    <>
      <WorkspaceHeaderComponent />
      <main className={styles.container}>{children}</main>
      <CommonFooter />
    </>
  )
}
