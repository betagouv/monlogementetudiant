'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_CATEGORY_LABELS } from '~/enums/support-ticket'
import {
  SUPPORT_TICKET_MESSAGE_MAX_LENGTH,
  type TSupportTicketCreate,
  ZSupportTicketCreate,
} from '~/schemas/support-tickets/support-ticket'
import { useTRPC } from '~/server/trpc/client'

export const SupportTicketForm = () => {
  const t = useTranslations('student.reportProblem.form')
  const trpc = useTRPC()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TSupportTicketCreate>({
    resolver: zodResolver(ZSupportTicketCreate),
    defaultValues: { message: '' },
  })

  const { mutate: createTicket, isPending } = useMutation(
    trpc.supportTickets.create.mutationOptions({
      onSuccess: () => {
        setSubmitError(null)
        setSubmitted(true)
        reset()
      },
      onError: (error) => {
        setSubmitError(error.message || t('errorToast'))
      },
    }),
  )

  if (submitted) {
    return (
      <Alert severity="success" title={t('successTitle')} description={t('successMessage')} closable onClose={() => setSubmitted(false)} />
    )
  }

  return (
    <form onSubmit={handleSubmit((data) => createTicket(data))} noValidate>
      {submitError && <Alert severity="error" title={submitError} description="" small className="fr-mb-3w" />}

      <Select
        label={t('categoryLabel')}
        nativeSelectProps={register('category')}
        state={errors.category ? 'error' : 'default'}
        stateRelatedMessage={errors.category?.message}
      >
        <option value="">{t('categoryPlaceholder')}</option>
        {SUPPORT_TICKET_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {SUPPORT_TICKET_CATEGORY_LABELS[category]}
          </option>
        ))}
      </Select>

      <Input
        label={t('messageLabel')}
        hintText={t('messageHint')}
        textArea
        nativeTextAreaProps={{ ...register('message'), rows: 8, maxLength: SUPPORT_TICKET_MESSAGE_MAX_LENGTH }}
        state={errors.message ? 'error' : 'default'}
        stateRelatedMessage={errors.message?.message}
      />

      <Button type="submit" disabled={isPending} iconId="ri-mail-send-line" iconPosition="left">
        {t('submit')}
      </Button>
    </form>
  )
}
