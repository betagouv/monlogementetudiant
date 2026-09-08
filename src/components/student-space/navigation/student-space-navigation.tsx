'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import SideMenu from '@codegouvfr/react-dsfr/SideMenu'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocalStorage } from 'usehooks-ts'
import { ALL_TODO_IDS } from '~/components/student-space/todo/student-todo-list'
import styles from './student-space-navigation.module.css'

const NAV_ITEMS = [
  { href: '/mon-espace/tableau-de-bord', labelKey: 'dashboard' },
  { href: '/mon-espace/to-do', labelKey: 'todoList' },
  { href: '/mon-espace/mon-budget', labelKey: 'budget' },
  { href: '/mon-espace/aides-au-logement', labelKey: 'housingAid' },
  { href: '/mon-espace/favoris', labelKey: 'favorites' },
  { href: '/mon-espace/alertes', labelKey: 'alerts' },
  { href: '/mon-espace/informations-personnelles', labelKey: 'personalInformations' },
] as const

export const StudentSpaceNavigation = () => {
  const t = useTranslations('student.navigation')
  const pathname = usePathname()
  // initializeWithValue: false → renvoie [] au SSR et au 1er rendu client (évite le mismatch d'hydratation),
  // puis lit le localStorage après montage.
  const [completedTodos] = useLocalStorage<string[]>('student-completed-todos', [], { initializeWithValue: false })

  const items = NAV_ITEMS.map(({ href, labelKey }) => ({
    isActive: pathname === href || pathname.startsWith(`${href}/`),
    linkProps: { href },
    text: labelKey === 'todoList' ? t('todoList', { done: completedTodos.length, total: ALL_TODO_IDS.length }) : t(labelKey),
  }))

  return (
    <>
      <div className="fr-border-bottom fr-p-3w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline" linkProps={{ href: '/' }}>
          {t('backToHome')}
        </Button>
      </div>
      <SideMenu align="left" burgerMenuButtonText={t('menuTitle')} items={items} classes={{ root: 'fr-p-3w', inner: styles.menuInner }} />
    </>
  )
}
