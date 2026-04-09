import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { TRPCReactProvider } from '~/providers/trpc-client'
import '~/globals.css'
import { Suspense } from 'react'
import { NextAppDirEmotionCacheProvider } from 'tss-react/next'
import Matomo from '~/app/matomo'
import { DossierFacileSuccessToast } from '~/components/dossier-facile/dossier-facile-success-toast'
import { JsonLd } from '~/components/seo/json-ld'
import { Signout } from '~/components/signout'
import Toaster from '~/components/ui/toaster'
import { DsfrHead, getHtmlAttributes } from '~/dsfr/dsfr-head'
import { DsfrProvider, StartDsfrOnHydration } from '~/dsfr/dsfr-provider'
import { buildOrganizationSchema, buildWebSiteSchema } from '~/utils/schema'

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
        <Suspense fallback={null}>
          <Matomo />
        </Suspense>
        <JsonLd data={[buildOrganizationSchema(), buildWebSiteSchema()]} />
      </head>
      <body>
        <NextAppDirEmotionCacheProvider options={{ key: 'css' }}>
          <StartDsfrOnHydration />
          <NextIntlClientProvider messages={messages}>
            <DsfrProvider lang={locale}>
              <TRPCReactProvider>
                <NuqsAdapter>
                  {children}
                  <Signout />
                  <Toaster />
                  <Suspense fallback={null}>
                    <DossierFacileSuccessToast />
                  </Suspense>
                </NuqsAdapter>
              </TRPCReactProvider>
            </DsfrProvider>
          </NextIntlClientProvider>
        </NextAppDirEmotionCacheProvider>
      </body>
    </html>
  )
}
