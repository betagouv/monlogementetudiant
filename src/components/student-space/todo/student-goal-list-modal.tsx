'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { ToggleSwitch } from '~/components/ui/toggle-switch'
import { EStudentGoalDueDelay, STUDENT_GOAL_DUE_DELAYS } from '~/enums/student-goal'
import { trackEvent } from '~/lib/tracking'
import {
  STUDENT_GOAL_TITLE_MAX_LENGTH,
  STUDENT_GOALS_MAX_PER_LIST,
  type TStudentGoalListCreate,
  ZStudentGoalListCreate,
} from '~/schemas/student-goals/student-goal-list'
import { useTRPC } from '~/server/trpc/client'
import styles from './student-goal-list-modal.module.css'

export const studentGoalListModal = createModal({
  id: 'student-goal-list-modal',
  isOpenedByDefault: false,
})

/** Liste existante passée en édition : identifiant et objectifs à pré-remplir. */
export type TEditableGoalList = {
  id: number
  emailRemindersEnabled: boolean
  goals: { id: number; title: string; dueDelay: EStudentGoalDueDelay }[]
}

const EMPTY_FORM: TStudentGoalListCreate = {
  emailRemindersEnabled: true,
  goals: [{ title: '', dueDelay: EStudentGoalDueDelay.ONE_WEEK }],
}

type StudentGoalListModalProps = {
  /** Liste à éditer, ou `null` pour une création. */
  editingList: TEditableGoalList | null
}

export const StudentGoalListModal = ({ editingList }: StudentGoalListModalProps) => {
  const t = useTranslations('student.todo.goals.modal')
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TStudentGoalListCreate>({
    resolver: zodResolver(ZStudentGoalListCreate),
    defaultValues: EMPTY_FORM,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'goals' })

  useEffect(() => {
    setSubmitError(null)
    reset(
      editingList
        ? {
            emailRemindersEnabled: editingList.emailRemindersEnabled,
            goals: editingList.goals.map((goal) => ({ id: goal.id, title: goal.title, dueDelay: goal.dueDelay })),
          }
        : EMPTY_FORM,
    )
  }, [editingList, reset])

  const onSaved = async (action: string) => {
    trackEvent({ category: 'Espace Etudiant', action })
    await queryClient.invalidateQueries({ queryKey: trpc.studentGoals.list.queryKey() })
    setSubmitError(null)
    studentGoalListModal.close()
    reset(EMPTY_FORM)
  }

  const { mutate: createList, isPending: isCreating } = useMutation(
    trpc.studentGoals.create.mutationOptions({
      onSuccess: () => onSaved('liste objectifs creee'),
      onError: () => setSubmitError(t('error')),
    }),
  )

  const { mutate: updateList, isPending: isUpdating } = useMutation(
    trpc.studentGoals.update.mutationOptions({
      onSuccess: () => onSaved('liste objectifs modifiee'),
      onError: () => setSubmitError(t('error')),
    }),
  )

  const isPending = isCreating || isUpdating

  const onSubmit = (data: TStudentGoalListCreate) => {
    if (editingList) {
      updateList({ ...data, listId: editingList.id })
    } else {
      createList(data)
    }
  }

  return (
    <studentGoalListModal.Component title={editingList ? t('editTitle') : t('title')} iconId="ri-list-unordered" size="large">
      <p>{t('intro')}</p>

      {submitError && <Alert severity="error" title={submitError} description="" small className="fr-mb-3w" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {fields.map((field, index) => {
          const isLastRow = index === fields.length - 1
          return (
            <div key={field.id} className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v">
              <div className="fr-flex-grow-1">
                <Input
                  label={`${t('goalLabel', { number: index + 1 })} *`}
                  hintText={t('goalHint')}
                  nativeInputProps={{ ...register(`goals.${index}.title`), maxLength: STUDENT_GOAL_TITLE_MAX_LENGTH }}
                  state={errors.goals?.[index]?.title ? 'error' : 'default'}
                  stateRelatedMessage={errors.goals?.[index]?.title?.message}
                />
              </div>
              <div className={styles.dueField}>
                <Select label={t('dueLabel')} hint={t('dueHint')} nativeSelectProps={register(`goals.${index}.dueDelay`)}>
                  {STUDENT_GOAL_DUE_DELAYS.map((delay) => (
                    <option key={delay} value={delay}>
                      {t(`delays.${delay}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.rowAction}>
                {isLastRow ? (
                  fields.length < STUDENT_GOALS_MAX_PER_LIST && (
                    <Button
                      type="button"
                      title={t('addGoal')}
                      priority="secondary"
                      iconId="ri-add-line"
                      onClick={() => append({ title: '', dueDelay: EStudentGoalDueDelay.ONE_WEEK })}
                    />
                  )
                ) : (
                  <Button
                    type="button"
                    title={t('removeGoal', { number: index + 1 })}
                    priority="secondary"
                    iconId="ri-delete-bin-line"
                    onClick={() => remove(index)}
                  />
                )}
              </div>
            </div>
          )
        })}

        <div className="fr-mt-3w">
          <Controller
            control={control}
            name="emailRemindersEnabled"
            render={({ field }) => (
              <ToggleSwitch
                label={t('emailReminders')}
                description={t('emailRemindersDescription')}
                labelPosition="left"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="fr-flex fr-justify-content-end fr-flex-gap-4v fr-mt-3w">
          <Button type="button" priority="secondary" onClick={() => studentGoalListModal.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('save')}
          </Button>
        </div>
      </form>
    </studentGoalListModal.Component>
  )
}
