import { CommonFooter } from '~/components/ui/footer/footer'
import { CommonHeader } from '~/components/ui/header/common-header'
import styles from './layout.module.css'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <a className="fr-link fr-sr-only fr-sr-only-focusable" href="#main-content">
        Aller au contenu principal
      </a>
      <CommonHeader />
      <main id="main-content" className={styles.container}>
        {children}
      </main>
      <CommonFooter />
    </>
  )
}
