'use client'

import MainNavigation, { MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './navigation.module.css'

export const WorkspaceHeaderNavigation: FC<{
  contactMode: EOwnerContactMode
  canManageUsers?: boolean
  canManageResidences?: boolean
  canManageApplications?: boolean
  isAdmin?: boolean
}> = ({ contactMode, canManageUsers = false, canManageResidences = false, canManageApplications = false, isAdmin = false }) => {
  const t = useTranslations('navigation.workspace')
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: MainNavigationProps.Item[] = [
    {
      isActive: pathname === '/bailleur/tableau-de-bord',
      linkProps: {
        href: buildHref('/bailleur/tableau-de-bord', searchParams),
        target: '_self',
      },
      text: t('dashboard'),
    },
    // Sans l'autorisation, chaque section renvoie au tableau de bord : on n'affiche pas le lien.
    ...(canManageResidences
      ? [
          {
            isActive: pathname === '/bailleur/residences',
            linkProps: {
              href: buildHref('/bailleur/residences', searchParams),
              target: '_self' as const,
            },
            text: t('residences'),
          },
        ]
      : []),
    // Les admins plateforme accèdent toujours aux Contacts (même si l'owner n'a pas encore choisi de mode).
    ...((contactMode !== 'none' || isAdmin) && canManageApplications
      ? [
          {
            isActive: pathname.startsWith('/bailleur/contacts'),
            linkProps: {
              href: buildHref('/bailleur/contacts', searchParams),
              target: '_self' as const,
            },
            text: t('contacts'),
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            isActive: pathname.startsWith('/bailleur/utilisateurs'),
            linkProps: {
              href: buildHref('/bailleur/utilisateurs', searchParams),
              target: '_self' as const,
            },
            text: t('users'),
          },
        ]
      : []),
    {
      isActive: pathname === '/bailleur/centre-d-aide',
      linkProps: {
        href: buildHref('/bailleur/centre-d-aide', searchParams),
        target: '_self',
      },
      text: t('helpCenter'),
    },
  ]

  return <MainNavigation classes={{ megaMenuCategory: styles.megaMenuCategory }} items={items} />
}
