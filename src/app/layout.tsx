import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { FooterComponent } from '~/components/ui/footer/footer'
import { HeaderComponent } from '~/components/ui/header/header'
import { TanstackQueryClientProvider } from '~/providers/tanstack-client'
import styles from './layout.module.css'
import '~/globals.css'
import { NextAppDirEmotionCacheProvider } from 'tss-react/next'
import Matomo from '~/app/matomo'
import Toaster from '~/components/ui/toaster'
import { DsfrHead, getHtmlAttributes } from '~/dsfr/dsfr-head'
import { DsfrProvider, StartDsfrOnHydration } from '~/dsfr/dsfr-provider'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('description'),
    title: t('title'),
    robots: {
      index: process.env.NEXT_PUBLIC_APP_ENV === 'production',
      follow: process.env.NEXT_PUBLIC_APP_ENV === 'production',
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html {...getHtmlAttributes({ lang: locale })} style={{ overflowX: 'hidden' }}>
      <head>
        <DsfrHead preloadFonts={['Marianne-Regular', 'Marianne-Medium', 'Marianne-Bold']} />
        <Matomo />
      </head>
      <body>
        <NextAppDirEmotionCacheProvider options={{ key: 'css' }}>
          <StartDsfrOnHydration />
          <NextIntlClientProvider messages={messages}>
            <DsfrProvider lang={locale}>
              <TanstackQueryClientProvider>
                <NuqsAdapter>
                  <HeaderComponent />
                  <main className={styles.container}>{children}</main>
                  <Toaster />
                  <FooterComponent />
                </NuqsAdapter>
              </TanstackQueryClientProvider>
            </DsfrProvider>
          </NextIntlClientProvider>
        </NextAppDirEmotionCacheProvider>
      </body>
    </html>
  )
}
