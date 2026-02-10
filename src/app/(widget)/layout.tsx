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
  return (
    <>
      <a className="fr-link fr-sr-only fr-sr-only-focusable" href="#main-content">
        Aller au contenu principal
      </a>
      <main id="main-content" className={styles.container}>
        {children}
      </main>
    </>
  )
}
