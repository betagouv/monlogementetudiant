import styles from './layout.module.css'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function WidgetLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <main className={styles.container}>{children}</main>
}
