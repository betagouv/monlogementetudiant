'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { ALL_TODOS } from '~/components/student-space/todo/student-todo-list'

export const StudentSpaceTodoNavigationButton = () => {
  const t = useTranslations('student.navigation')
  const [completedTodos] = useLocalStorage<string[]>('student-completed-todos', [])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return (
    <Button priority="tertiary no outline" iconPosition="left" iconId="ri-todo-line" linkProps={{ href: '/mon-espace/to-do' }}>
      {isHydrated
        ? t('todoList', { done: completedTodos.length, total: ALL_TODOS.length })
        : t('todoList', { done: 0, total: ALL_TODOS.length })}
    </Button>
  )
}
