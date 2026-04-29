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
