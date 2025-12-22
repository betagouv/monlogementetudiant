'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { ALL_TODOS } from '~/components/student-space/todo/student-todo-list'
import styles from './student-maximize-chances.module.css'

export const StudentMaximizeChances = () => {
  const t = useTranslations('student.maximizeChances')
  const [completedTodos] = useLocalStorage<string[]>('student-completed-todos', [])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const isTodoListComplete = isHydrated && completedTodos.length === ALL_TODOS.length

  const items = [
    {
      id: 1,
      label: t('completeTodoList.title'),
      button: t('completeTodoList.cta'),
      href: 'to-do',
      isComplete: isTodoListComplete,
    },
    // { id: 2, label: t('estimateAid.title'), button: t('estimateAid.cta'), href: 'to-do' },
    { id: 3, label: t('createAlerts.title'), button: t('createAlerts.cta'), href: 'alertes' },
  ]

  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-pt-4w fr-px-6w fr-pb-6w">
      <span className="fr-h4">{t('title')}</span>
      <div className="fr-background-default--grey">
        <div className="fr-flex fr-direction-column fr-justify-content-space-between fr-px-4w">
          {items.map((item, index) => (
            <div
              className={clsx(
                index !== items.length - 1 ? 'fr-border-bottom' : '',
                'fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-md-center fr-py-4w',
              )}
              key={item.id}
            >
              <div>
                <span
                  className={clsx(styles.icon, item.isComplete ? styles.completed : styles.uncompleted, 'fr-mr-1v ri-checkbox-circle-fill')}
                />
                <span className="fr-h6 fr-text--normal">{item.label}</span>
              </div>
              <Button priority="tertiary no outline" linkProps={{ href: item.href }} iconPosition="right" iconId="ri-arrow-right-line">
                {item.button}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
