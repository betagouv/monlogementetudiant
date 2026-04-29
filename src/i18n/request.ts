import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

export enum AvailableLocales {
  EN = 'en',
  FR = 'fr',
}

export const resolveLocale = (value?: string | null): AvailableLocales => {
  const normalizedValue = value?.toLowerCase()

  if (normalizedValue?.startsWith(AvailableLocales.EN)) {
    return AvailableLocales.EN
  }

  return AvailableLocales.FR
}

export default getRequestConfig(async () => {
  const [cookieStore, headersStore] = await Promise.all([cookies(), headers()])
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value ?? headersStore.get('accept-language'))

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
