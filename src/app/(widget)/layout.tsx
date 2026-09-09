import { Suspense } from 'react'
import { WidgetCampaignProvider } from '~/components/widget/widget-campaign-context'
import { WidgetLoadTracker } from '~/components/widget/widget-load-tracker'
import WidgetMatomo from '~/components/widget/widget-matomo'
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
    <main className={styles.container}>
      <Suspense>
        <WidgetMatomo />
      </Suspense>
      <Suspense>
        <WidgetCampaignProvider>
          <WidgetLoadTracker />
          {children}
        </WidgetCampaignProvider>
      </Suspense>
    </main>
  )
}
