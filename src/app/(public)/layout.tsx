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
      <CommonHeader />
      <main className={styles.container}>{children}</main>
      <CommonFooter />
    </>
  )
}
