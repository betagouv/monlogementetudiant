import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { resolveLocale } from '~/i18n/locales'

export default getRequestConfig(async () => {
  const [cookieStore, headersStore] = await Promise.all([cookies(), headers()])
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value ?? headersStore.get('accept-language'))

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
