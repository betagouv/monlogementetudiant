import dayjs from 'dayjs'
import 'dayjs/locale/en'
import 'dayjs/locale/fr'

import { resolveLocale } from '~/i18n/locales'

export const formatDayjs = (date: dayjs.ConfigType, formatString: string, locale?: string | null) => {
  return dayjs(date).locale(resolveLocale(locale)).format(formatString)
}
