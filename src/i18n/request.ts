import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { resolveLocale } from '~/i18n/locales'

export default getRequestConfig(async () => {
  const [cookieStore, headersStore] = await Promise.all([cookies(), headers()])
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value ?? headersStore.get('accept-language'))

  // Les messages de validation des schémas Zod vivent dans leur propre fichier : le traducteur FR par défaut
  // (`src/schemas/schema-translator.ts`) n'embarque ainsi que ce fichier dans le bundle client, pas tout fr.json.
  const [messages, schemasMessages] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/schemas/${locale}.json`),
  ])

  return {
    locale,
    messages: { ...messages.default, schemas: schemasMessages.default },
  }
})
