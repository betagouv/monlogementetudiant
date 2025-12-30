'use client'

import MainNavigation, { MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import styles from './navigation.module.css'

export const WorkspaceHeaderNavigation: FC = () => {
  const t = useTranslations('navigation.workspace')
  const pathname = usePathname()

  const items: MainNavigationProps.Item[] = [
    {
      isActive: pathname === '/bailleur/tableau-de-bord',
      linkProps: {
        href: '/bailleur/tableau-de-bord',
        target: '_self',
      },
      text: t('dashboard'),
    },
    {
      isActive: pathname === '/bailleur/residences',
      linkProps: {
        href: '/bailleur/residences',
        target: '_self',
      },
      text: t('residences'),
    },
    // {
    //   isActive: pathname === '/bailleur/candidatures',
    //   linkProps: {
    //     href: '/bailleur/candidatures',
    //     target: '_self',
    //   },
    //   text: t('candidates'),
    // },
    {
      isActive: pathname === '/bailleur/centre-d-aide',
      linkProps: {
        href: '/bailleur/centre-d-aide',
        target: '_self',
      },
      text: t('helpCenter'),
    },
  ]

  return <MainNavigation classes={{ megaMenuCategory: styles.megaMenuCategory }} items={items} />
}
