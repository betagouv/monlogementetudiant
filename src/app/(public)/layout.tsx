import { FooterComponent } from '~/components/ui/footer/footer'
import { HeaderComponent } from '~/components/ui/header/common-header'
import styles from './layout.module.css'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <HeaderComponent />
      <main className={styles.container}>{children}</main>
      <FooterComponent />
    </>
  )
}
