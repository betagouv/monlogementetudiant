'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { useAdminStats } from '~/hooks/use-admin-stats'

type NavItem = {
  label: string
  icon: string
  href: string
  badgeKey?: 'owners' | 'users'
}

type NavSection = {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Navigation',
    items: [{ label: 'Tableau de bord', icon: 'fr-icon-dashboard-3-line', href: '/administration/tableau-de-bord' }],
  },
  {
    title: 'Utilisateurs',
    items: [
      { label: 'Gestionnaires', icon: 'fr-icon-building-line', href: '/administration/bailleurs', badgeKey: 'owners' },
      { label: 'Étudiants', icon: 'fr-icon-user-line', href: '/administration/utilisateurs', badgeKey: 'users' },
    ],
  },
  {
    title: 'Contenu',
    items: [
      { label: 'Résidences', icon: 'fr-icon-home-4-line', href: '/administration/residences' },
      { label: 'Candidatures', icon: 'fr-icon-file-text-line', href: '/administration/candidatures' },
    ],
  },
  {
    title: 'Système',
    items: [{ label: 'Journaux', icon: 'fr-icon-article-line', href: '/administration/journaux' }],
  },
]

export const AdminNavigation = () => {
  const pathname = usePathname()
  const { data: stats } = useAdminStats()

  const getBadgeValue = (key?: string) => {
    if (!stats || !key) return null
    if (key === 'owners') return stats.owners
    if (key === 'users') return stats.users.students
    return null
  }

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        {navSections.map((section) => (
          <div key={section.title}>
            <div className={styles.navSectionTitle}>{section.title}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const badgeValue = getBadgeValue(item.badgeKey)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx('fr-link--no-underline', isActive ? styles.navItemActive : styles.navItem)}
                >
                  <span className={item.icon} aria-hidden="true" />
                  {item.label}
                  {badgeValue !== null && <span className={styles.navBadge}>{badgeValue}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <div className="fr-text--bold">Mon Logement Etudiant</div>
        <div>Administration</div>
      </div>
    </aside>
  )
}
