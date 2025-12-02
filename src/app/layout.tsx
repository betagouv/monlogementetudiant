import * as Sentry from '@sentry/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { FooterComponent } from '~/components/ui/footer/footer'
import { NextAuthProvider } from '~/providers/next-auth'
import { TanstackQueryClientProvider } from '~/providers/tanstack-client'
import '~/globals.css'
import { NextAppDirEmotionCacheProvider } from 'tss-react/next'
import Matomo from '~/app/matomo'
import { auth } from '~/auth'
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
    other: {
      ...Sentry.getTraceData(),
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
  const session = await auth()

  return (
    <html {...getHtmlAttributes({ lang: locale })} style={{ overflowX: 'hidden' }}>
      <head>
        <DsfrHead preloadFonts={['Marianne-Regular', 'Marianne-Medium', 'Marianne-Bold']} />
        <Matomo />
      </head>
      <body>
        <NextAppDirEmotionCacheProvider options={{ key: 'css' }}>
          <StartDsfrOnHydration />
          <NextAuthProvider session={session}>
            <NextIntlClientProvider messages={messages}>
              <DsfrProvider lang={locale}>
                <TanstackQueryClientProvider>
                  <NuqsAdapter>
                    {children}
                    <Toaster />
                    <FooterComponent />
                  </NuqsAdapter>
                </TanstackQueryClientProvider>
              </DsfrProvider>
            </NextIntlClientProvider>
          </NextAuthProvider>
        </NextAppDirEmotionCacheProvider>
      </body>
    </html>
  )
}
