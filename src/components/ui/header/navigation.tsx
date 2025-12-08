'use client'

import MainNavigation, { MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { FC } from 'react'
import styles from './navigation.module.css'

// export const HeaderNavigation: FC<{ academies: TAcademyOrDepartment[] }> = ({ academies }) => {
export const HeaderNavigation: FC = () => {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  let items: MainNavigationProps.Item[] = [
    {
      isActive: pathname === '/trouver-un-logement-etudiant',
      linkProps: {
        href: '/trouver-un-logement-etudiant',
        target: '_self',
      },
      text: t('findAccommodation'),
    },
    {
      isActive: pathname === '/preparer-mon-budget-etudiant',
      text: t('prepareBudget.title'),
      menuLinks: [
        {
          linkProps: {
            href: '/simuler-budget',
            target: '_self',
          },
          text: t('prepareBudget.calculator'),
        },
        {
          linkProps: {
            href: '/preparer-mon-budget-etudiant',
            target: '_self',
          },
          text: t('prepareBudget.hints'),
        },
      ],
    },
    {
      isActive: pathname === '/simuler-mes-aides-au-logement',
      linkProps: {
        href: '/simuler-mes-aides-au-logement',
        target: '_self',
      },
      text: t('home'),
    },
  ]
  if (pathname.includes('landing')) {
    items = []
  }
  return <MainNavigation classes={{ megaMenuCategory: styles.megaMenuCategory }} items={items} />
}
