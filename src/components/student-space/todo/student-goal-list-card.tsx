'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import styles from './student-todo-list.module.css'

type TGoalItem = {
  id: number
  title: string
  isCompleted: boolean
}

type StudentGoalListCardProps = {
  /** Numéro d'affichage de la liste (« Liste personnalisée n°X »), basé sur l'ordre de création. */
  number: number
  goals: TGoalItem[]
  borderStyle: string
  onEdit: () => void
  onToggleGoal: (goalId: number, isCompleted: boolean) => void
}

export const StudentGoalListCard = ({ number, goals, borderStyle, onEdit, onToggleGoal }: StudentGoalListCardProps) => {
  const t = useTranslations('student.todo.goals')
  const remainingCount = goals.filter((goal) => !goal.isCompleted).length

  return (
    <div className={clsx(styles.container, borderStyle, 'fr-flex fr-direction-column fr-background-default--grey fr-p-3w')}>
      <div className="fr-flex fr-align-items-center fr-justify-content-space-between">
        <h3 className="fr-h6 fr-mb-0">{t('listTitle', { number })}</h3>
        <Button title={t('edit', { number })} size="small" priority="tertiary" iconId="ri-pencil-line" onClick={onEdit} />
      </div>
      <Checkbox
        className="fr-mt-2w fr-mb-0"
        options={goals.map((goal) => ({
          label: goal.title,
          nativeInputProps: {
            checked: goal.isCompleted,
            onChange: (event) => onToggleGoal(goal.id, event.target.checked),
          },
        }))}
      />
      {remainingCount > 0 && (
        <div>
          <Badge severity="new" noIcon small>
            {t('remainingTasks', { count: remainingCount })}
          </Badge>
        </div>
      )}
    </div>
  )
}
