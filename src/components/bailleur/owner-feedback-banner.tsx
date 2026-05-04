'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'
import { type TOwnerFeedbackSubmit, ZOwnerFeedbackSubmit } from '~/schemas/owner-feedback'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import styles from './owner-feedback-banner.module.css'

const SNOOZE_KEY = 'jde-owner-feedback-snoozed'
const RATINGS = [1, 2, 3, 4, 5] as const

export function OwnerFeedbackBanner() {
  const t = useTranslations('bailleur.feedback')
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [snoozedInSession, setSnoozedInSession] = useState(false)

  useEffect(() => {
    setSnoozedInSession(sessionStorage.getItem(SNOOZE_KEY) === 'true')
  }, [])

  const { data } = useQuery(trpc.ownerFeedback.getStatus.queryOptions())

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TOwnerFeedbackSubmit>({
    resolver: zodResolver(ZOwnerFeedbackSubmit),
  })

  const selectedRating = watch('rating')

  const submitMutation = useMutation({
    mutationFn: (input: TOwnerFeedbackSubmit) => trpcClient.ownerFeedback.submit.mutate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.ownerFeedback.getStatus.queryKey() })
      createToast({ priority: 'success', message: t('successToast') })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('errorToast') })
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: () => trpcClient.ownerFeedback.snooze.mutate(),
    onSuccess: async () => {
      sessionStorage.setItem(SNOOZE_KEY, 'true')
      setSnoozedInSession(true)
      await queryClient.invalidateQueries({ queryKey: trpc.ownerFeedback.getStatus.queryKey() })
    },
  })

  if (!data || data.status === 'submitted' || (data.status === 'snoozed' && snoozedInSession)) {
    return null
  }

  const onSubmit = (values: TOwnerFeedbackSubmit) => {
    submitMutation.mutate(values)
  }

  const isBusy = submitMutation.isPending || snoozeMutation.isPending

  return (
    <section className={styles.banner} aria-label={t('ariaBanner')}>
      <div className={clsx('fr-container', styles.container)}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('title')}</h2>
          <Button
            type="button"
            priority="tertiary"
            iconId="fr-icon-close-line"
            iconPosition="right"
            size="small"
            onClick={() => snoozeMutation.mutate()}
            disabled={isBusy}
          >
            {t('close')}
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.ratingBlock}>
            <p className={styles.question}>{t('ratingQuestion')}</p>
            <div className={styles.ratingButtons} role="radiogroup" aria-label={t('ariaRating')}>
              {RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selectedRating === value}
                  className={clsx(styles.ratingButton, selectedRating === value && styles.ratingButtonSelected)}
                  onClick={() => setValue('rating', value, { shouldValidate: true })}
                  disabled={isBusy}
                >
                  {value}
                </button>
              ))}
            </div>
            {errors.rating && <p className={styles.error}>{t('ratingRequired')}</p>}
          </div>

          <Input
            className={styles.commentBlock}
            label={t('commentLabel')}
            textArea
            nativeTextAreaProps={{
              rows: 2,
              disabled: isBusy,
              ...register('comment'),
            }}
            state={errors.comment ? 'error' : 'default'}
            stateRelatedMessage={errors.comment?.message}
          />

          <Button type="submit" priority="primary" disabled={isBusy}>
            {t('submit')}
          </Button>
        </form>
      </div>
    </section>
  )
}
