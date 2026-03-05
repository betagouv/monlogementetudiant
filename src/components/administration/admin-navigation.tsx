'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Tableau de bord', icon: 'fr-icon-dashboard-3-line' as const, href: '/administration/tableau-de-bord' },
  { label: 'Utilisateurs', icon: 'fr-icon-user-line' as const, href: '/administration/utilisateurs' },
  { label: 'Bailleurs', icon: 'fr-icon-building-line' as const, href: '/administration/bailleurs' },
]

export const AdminNavigation = () => {
  const pathname = usePathname()

  return (
    <>
      <div className="fr-py-3w fr-px-2w" style={{ background: 'var(--background-action-high-blue-france)', color: 'white' }}>
        <div className="fr-text--bold fr-text--sm fr-mb-0" style={{ color: 'white', letterSpacing: '0.1em' }}>
          ESPACE GESTIONNAIRE
        </div>
      </div>
      <div className="fr-py-2w fr-px-1w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline" size="small" linkProps={{ href: '/' }}>
          Retour a l'accueil
        </Button>
      </div>
      <nav className="fr-flex fr-direction-column fr-flex-gap-1v fr-px-1w fr-pb-3w">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Button
              key={item.href}
              priority="tertiary no outline"
              iconPosition="left"
              iconId={item.icon}
              size="small"
              linkProps={{ href: item.href }}
              style={
                isActive
                  ? {
                      background: 'var(--background-action-low-blue-france)',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }
                  : { borderRadius: '4px' }
              }
            >
              {item.label}
            </Button>
          )
        })}
      </nav>
    </>
  )
}
