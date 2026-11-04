'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import SideMenu, { type SideMenuProps } from '@codegouvfr/react-dsfr/SideMenu'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocalStorage } from 'usehooks-ts'
import { ALL_TODO_IDS } from '~/components/student-space/todo/student-todo-list'
import styles from './student-space-navigation.module.css'

type NavLink = { href: string; labelKey: string; iconClass?: string }
type NavItem = NavLink | { labelKey: string; iconClass: string; children: NavLink[] }

const NAV_ITEMS: NavItem[] = [
  { href: '/mon-espace/tableau-de-bord', iconClass: 'fr-icon-layout-grid-line', labelKey: 'dashboard' },
  { href: '/mon-espace/to-do', iconClass: 'fr-icon-todo-line', labelKey: 'todoList' },
  {
    labelKey: 'search',
    iconClass: 'fr-icon-search-line',
    children: [
      { href: '/mon-espace/alertes', labelKey: 'alerts' },
      { href: '/mon-espace/favoris', labelKey: 'favorites' },
    ],
  },
  {
    labelKey: 'installation',
    iconClass: 'fr-icon-calculator-line',
    children: [
      { href: '/mon-espace/mon-budget', labelKey: 'budget' },
      { href: '/mon-espace/aides-au-logement', labelKey: 'housingAid' },
    ],
  },
  { href: '/mon-espace/informations-personnelles', iconClass: 'fr-icon-user-line', labelKey: 'personalInformations' },
  { href: '/mon-espace/signaler-un-probleme', iconClass: 'fr-icon-error-warning-line', labelKey: 'reportProblem' },
]

export const StudentSpaceNavigation = () => {
  const t = useTranslations('student.navigation')
  const pathname = usePathname()
  // initializeWithValue: false → renvoie [] au SSR et au 1er rendu client (évite le mismatch d'hydratation),
  // puis lit le localStorage après montage.
  const [completedTodos] = useLocalStorage<string[]>('student-completed-todos', [], { initializeWithValue: false })

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const label = (labelKey: string) =>
    labelKey === 'todoList' ? t('todoList', { done: completedTodos.length, total: ALL_TODO_IDS.length }) : t(labelKey)

  const text = ({ labelKey, iconClass }: { labelKey: string; iconClass?: string }) => (
    <>
      {iconClass && <span className={clsx(iconClass, 'fr-mr-1w')} aria-hidden="true" />}
      {label(labelKey)}
    </>
  )

  const items: SideMenuProps.Item[] = NAV_ITEMS.map((item) =>
    'children' in item
      ? {
          text: text(item),
          isActive: item.children.some((child) => isActive(child.href)),
          items: item.children.map((child) => ({
            text: text(child),
            linkProps: { href: child.href },
            isActive: isActive(child.href),
          })),
        }
      : {
          text: text(item),
          linkProps: { href: item.href },
          isActive: isActive(item.href),
        },
  )

  return (
    <>
      <div className="fr-border-bottom fr-p-3w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline" linkProps={{ href: '/' }}>
          {t('backToHome')}
        </Button>
      </div>
      <SideMenu
        align="left"
        burgerMenuButtonText={t('menuTitle')}
        items={items}
        classes={{ root: clsx('fr-p-3w', styles.menuRoot), inner: styles.menuInner }}
        {...{ 'aria-label': t('menuTitle') }}
      />
    </>
  )
}
