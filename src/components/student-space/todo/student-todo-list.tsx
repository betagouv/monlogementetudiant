'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import LocationFrance from '@codegouvfr/react-dsfr/picto/LocationFrance'
import Money from '@codegouvfr/react-dsfr/picto/Money'
import Notification from '@codegouvfr/react-dsfr/picto/Notification'
import Success from '@codegouvfr/react-dsfr/picto/Success'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import type { EStudentGoalDueDelay } from '~/enums/student-goal'
import { trackEvent } from '~/lib/tracking'
import { useTRPC } from '~/server/trpc/client'
import { StudentGoalListCard } from './student-goal-list-card'
import { StudentGoalListModal, studentGoalListModal, type TEditableGoalList } from './student-goal-list-modal'
import styles from './student-todo-list.module.css'

/**
 * Partie non traduisible de chaque tâche : identifiant, pictogramme et destination.
 * Les intitulés vivent dans `student.todo.items`, ce qui impose de construire la liste
 * dans le composant — un tableau de niveau module ne peut pas appeler useTranslations.
 */
const TODO_DEFINITIONS = [
  {
    id: 'simulate-housing-aid',
    key: 'simulateHousingAid',
    pictogram: <Money width={48} height={48} />,
    href: '/simuler-budget',
    external: true,
  },
  {
    id: 'anticipate-student-budget',
    key: 'anticipateStudentBudget',
    pictogram: <LocationFrance width={48} height={48} />,
    href: '/preparer-mon-budget-etudiant',
    external: true,
  },
  {
    id: 'submit-applications',
    key: 'submitApplications',
    pictogram: <Success width={48} height={48} />,
    href: '/trouver-un-logement-etudiant',
    external: true,
  },
  {
    id: 'create-housing-alert',
    key: 'createHousingAlert',
    pictogram: <Notification width={48} height={48} />,
    href: '/mon-espace/alertes',
    external: false,
  },
] as const

/** Identifiants des tâches, exportés pour le décompte affiché dans la navigation. */
export const ALL_TODO_IDS = TODO_DEFINITIONS.map((definition) => definition.id)

type TTodoItem = {
  id: string
  label: string
  description: string
  duration: string
  pictogram: ReactNode
  cta: ReactNode
}

export const StudentTodoList = () => {
  const t = useTranslations('student.todo')
  const tA11y = useTranslations('accessibility')
  const [completedTodos, setCompletedTodos] = useLocalStorage<string[]>('student-completed-todos', [])
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [editingList, setEditingList] = useState<TEditableGoalList | null>(null)

  const { data: goalLists } = useQuery(trpc.studentGoals.list.queryOptions())

  const { mutate: toggleGoal } = useMutation(
    trpc.studentGoals.toggleGoal.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.studentGoals.list.queryKey() }),
    }),
  )

  const items: TTodoItem[] = TODO_DEFINITIONS.map((definition) => {
    const label = t(`items.${definition.key}.cta`)
    return {
      id: definition.id,
      label: t(`items.${definition.key}.label`),
      description: t(`items.${definition.key}.description`),
      duration: t(`items.${definition.key}.duration`),
      pictogram: definition.pictogram,
      cta: (
        <Button
          size="small"
          priority="secondary"
          linkProps={{
            href: definition.href,
            ...(definition.external
              ? { target: '_blank', 'aria-label': tA11y('linkNewWindow', { label: t(`items.${definition.key}.ctaLabel`) }) }
              : { 'aria-label': t(`items.${definition.key}.ctaLabel`) }),
          }}
        >
          {label}
        </Button>
      ),
    }
  })

  const itemsTodo = items.filter((todo) => !completedTodos.includes(todo.id))
  const itemsDone = items.filter((todo) => completedTodos.includes(todo.id))

  const markAsCompleted = (todoId: string) => {
    if (!completedTodos.includes(todoId)) {
      trackEvent({ category: 'Espace Etudiant', action: 'todo fait', name: todoId })
      setCompletedTodos((previous) => [...previous, todoId])
    }
  }

  const markAsTodo = (todoId: string) => {
    trackEvent({ category: 'Espace Etudiant', action: 'todo remis', name: todoId })
    setCompletedTodos((previous) => previous.filter((id) => id !== todoId))
  }

  const numberedGoalLists = (goalLists ?? []).map((list, index) => ({ ...list, number: index + 1 }))
  const goalListsTodo = numberedGoalLists.filter((list) => list.goals.some((goal) => !goal.isCompleted))
  const goalListsDone = numberedGoalLists.filter((list) => list.goals.length > 0 && list.goals.every((goal) => goal.isCompleted))

  const openCreateListModal = () => {
    setEditingList(null)
    studentGoalListModal.open()
  }

  const openEditListModal = (list: (typeof numberedGoalLists)[number]) => {
    setEditingList({
      id: list.id,
      emailRemindersEnabled: list.emailRemindersEnabled,
      goals: list.goals.map((goal) => ({ id: goal.id, title: goal.title, dueDelay: goal.dueDelay as EStudentGoalDueDelay })),
    })
    studentGoalListModal.open()
  }

  const handleToggleGoal = (goalId: number, isCompleted: boolean) => {
    trackEvent({ category: 'Espace Etudiant', action: isCompleted ? 'objectif fait' : 'objectif remis' })
    toggleGoal({ goalId, isCompleted })
  }

  const renderGoalCards = (lists: typeof numberedGoalLists, borderStyle: string) =>
    lists.map((list) => (
      <StudentGoalListCard
        key={list.id}
        number={list.number}
        goals={list.goals}
        borderStyle={borderStyle}
        onEdit={() => openEditListModal(list)}
        onToggleGoal={handleToggleGoal}
      />
    ))

  const createListCard = (
    <div className={clsx(styles.container, styles.itemToDoBorder, 'fr-flex fr-direction-column fr-background-default--grey fr-p-3w')}>
      <h3 className="fr-h6 fr-mb-0">{t('goals.createCard.title')}</h3>
      {t('goals.createCard.description')}
      <div className="fr-mt-2w">
        <Button size="small" priority="secondary" iconId="ri-add-line" onClick={openCreateListModal}>
          {t('goals.createCard.cta')}
        </Button>
      </div>
    </div>
  )

  const renderSection = (
    title: string,
    sectionItems: TTodoItem[],
    borderStyle: string,
    action?: 'complete' | 'undo',
    leadingCards?: ReactNode,
    trailingCards?: ReactNode,
  ) => (
    <div className="fr-flex fr-direction-column">
      <h2 className="fr-text--lg fr-text-title--grey fr-text--bold">{title}</h2>
      <div className="fr-flex fr-direction-column fr-flex-gap-6v">
        {leadingCards}
        {sectionItems.map((item) => (
          <div
            key={item.id}
            className={clsx(styles.container, borderStyle, 'fr-flex fr-direction-column fr-background-default--grey fr-p-3w')}
          >
            <div className="fr-flex fr-align-items-center fr-justify-content-space-between">
              {item.pictogram}
              {action === 'complete' && (
                <Button
                  title={t('markDone')}
                  size="small"
                  priority="tertiary"
                  iconId="ri-check-line"
                  onClick={() => markAsCompleted(item.id)}
                />
              )}
              {action === 'undo' && (
                <Button
                  title={t('markTodo')}
                  size="small"
                  priority="tertiary"
                  iconId="ri-arrow-go-back-line"
                  onClick={() => markAsTodo(item.id)}
                />
              )}
            </div>
            <h3 className="fr-h6 fr-mb-0">{item.label}</h3>
            {item.description}
            <span className="fr-text--xs fr-mb-0 fr-hidden-sm">{item.duration}</span>
            <div className="fr-flex fr-mt-2w fr-align-items-center fr-justify-content-space-between">
              <div className="fr-flex fr-flex-gap-2v">{item.cta}</div>
              <span className="fr-text--xs fr-mb-0 fr-hidden fr-unhidden-md">{item.duration}</span>
            </div>
          </div>
        ))}
        {trailingCards}
      </div>
    </div>
  )

  return (
    <>
      {renderSection(
        t('sectionTodo'),
        itemsTodo,
        styles.itemToDoBorder,
        'complete',
        renderGoalCards(goalListsTodo, styles.itemToDoBorder),
        createListCard,
      )}
      {renderSection(t('sectionDone'), itemsDone, styles.itemDoneBorder, 'undo', renderGoalCards(goalListsDone, styles.itemDoneBorder))}
      <StudentGoalListModal editingList={editingList} />
    </>
  )
}
