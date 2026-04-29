'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { useRouter } from 'next/navigation'
import { FC } from 'react'

import { AvailableLocales } from '~/i18n/locales'

type LanguageLinkProps = {
  activeLocale: AvailableLocales
  fullNameByLang: string
  locale: AvailableLocales
}

export const LanguageLink: FC<LanguageLinkProps> = ({ activeLocale, fullNameByLang, locale }) => {
  const router = useRouter()

  const handleLocale = (locale: AvailableLocales) => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <a
      className={fr.cx('fr-translate__language', 'fr-nav__link')}
      href=""
      aria-current={activeLocale === locale ? 'true' : undefined}
      onClick={() => handleLocale(locale)}
    >
      <span className="short-label">{locale.toUpperCase()}</span>
      &nbsp;-&nbsp;
      {fullNameByLang}
    </a>
  )
}
