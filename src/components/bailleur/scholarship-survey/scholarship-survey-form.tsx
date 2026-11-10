'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { createToast } from '~/components/ui/createToast'
import { createZScholarshipSurveyAnswer, isAnswerFilled, type TScholarshipSurveyAnswer } from '~/schemas/scholarship-survey'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './scholarship-survey-form.module.css'
import { ScholarshipSurveyMissingModal, scholarshipSurveyMissingModal } from './scholarship-survey-missing-modal'

type RowDraft = { accommodationId: number; name: string; count: string; rate: string; notMeasured: boolean }

const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value))

const toAnswer = (row: RowDraft): TScholarshipSurveyAnswer => ({
  accommodationId: row.accommodationId,
  scholarshipCount: row.notMeasured ? null : toNumber(row.count),
  scholarshipRate: row.notMeasured ? null : toNumber(row.rate),
  notMeasured: row.notMeasured,
})

export function ScholarshipSurveyForm({ ownerId, schoolYear }: { ownerId?: number; schoolYear: string }) {
  const t = useTranslations('bailleur.scholarshipSurvey')
  const tSchemas = useTranslations('schemas')
  const answerSchema = useMemo(() => createZScholarshipSurveyAnswer(tSchemas), [tSchemas])
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dashboardHref = buildHref('/bailleur/tableau-de-bord', searchParams)

  const { data } = useQuery(trpc.scholarshipSurvey.getForm.queryOptions({ ownerId }))
  const [rows, setRows] = useState<RowDraft[] | null>(null)
  const [missing, setMissing] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    if (!data || rows) return
    setRows(
      data.residences.map((r) => ({
        accommodationId: r.id,
        name: r.name,
        count: r.answer?.scholarshipCount?.toString() ?? '',
        rate: r.answer?.scholarshipRate?.toString() ?? '',
        notMeasured: r.answer?.notMeasured ?? false,
      })),
    )
  }, [data, rows])

  const errors = useMemo(() => {
    const byRow = new Map<number, { count?: string; rate?: string }>()
    for (const row of rows ?? []) {
      const result = answerSchema.safeParse(toAnswer(row))
      if (result.success) continue
      const rowErrors: { count?: string; rate?: string } = {}
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'scholarshipCount') rowErrors.count = issue.message
        if (issue.path[0] === 'scholarshipRate') rowErrors.rate = issue.message
      }
      byRow.set(row.accommodationId, rowErrors)
    }
    return byRow
  }, [rows, answerSchema])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.scholarshipSurvey.getForm.queryKey() })

  const saveMutation = useMutation({
    mutationFn: (answers: TScholarshipSurveyAnswer[]) => trpcClient.scholarshipSurvey.save.mutate({ ownerId, answers }),
    onSuccess: async () => {
      await invalidate()
      createToast({ priority: 'info', message: t('draftSavedToast') })
      router.push(dashboardHref)
    },
    onError: () => createToast({ priority: 'error', message: t('errorToast') }),
  })

  const submitMutation = useMutation({
    mutationFn: (answers: TScholarshipSurveyAnswer[]) => trpcClient.scholarshipSurvey.submit.mutate({ ownerId, answers }),
    onSuccess: async (result) => {
      await invalidate()
      router.refresh()
      if (result.missing.length === 0) {
        createToast({ priority: 'success', message: t('successToast') })
        router.push(dashboardHref)
        return
      }
      setMissing(result.missing)
      scholarshipSurveyMissingModal.open()
    },
    onError: () => createToast({ priority: 'error', message: t('errorToast') }),
  })

  if (!rows) return null

  if (rows.length === 0) {
    return <p>{t('noResidences')}</p>
  }

  const updateRow = (accommodationId: number, patch: Partial<RowDraft>) =>
    setRows((current) => current?.map((row) => (row.accommodationId === accommodationId ? { ...row, ...patch } : row)) ?? null)

  const allNotMeasured = rows.every((row) => row.notMeasured)
  const toggleAll = (checked: boolean) =>
    setRows((current) => current?.map((row) => ({ ...row, notMeasured: checked, ...(checked ? { count: '', rate: '' } : {}) })) ?? null)

  const filledCount = rows.filter((row) => isAnswerFilled(toAnswer(row))).length
  const hasErrors = errors.size > 0
  const isBusy = saveMutation.isPending || submitMutation.isPending
  const answers = () => rows.map(toAnswer)

  return (
    <div className={clsx('fr-p-3w fr-p-md-6w', styles.card)}>
      <div
        className={clsx(
          'fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-wrap fr-flex-gap-2v fr-pb-3w',
          styles.separator,
        )}
      >
        <h2 className="fr-h5 fr-mb-0">{t('residencesTitle')}</h2>
        <p className="fr-text--sm fr-text-mention--grey fr-mb-0" aria-live="polite">
          {t('progress', { filled: filledCount, total: rows.length })}
        </p>
      </div>

      <div className={clsx('fr-py-3w', styles.separator)}>
        <Checkbox
          className="fr-mb-0"
          options={[
            {
              label: t('notMeasuredAll'),
              nativeInputProps: { checked: allNotMeasured, onChange: (e) => toggleAll(e.target.checked), disabled: isBusy },
            },
          ]}
        />
      </div>

      {rows.map((row) => {
        const rowErrors = errors.get(row.accommodationId)
        return (
          <fieldset key={row.accommodationId} className={clsx('fr-py-3w', styles.separator, styles.row)}>
            <legend className="fr-text--bold fr-mb-2w">{row.name}</legend>
            <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom">
              <div className="fr-col-12 fr-col-md-5">
                <Input
                  className="fr-mb-0"
                  label={t('countLabel')}
                  hintText={t('countHint', { year: schoolYear })}
                  disabled={row.notMeasured || isBusy}
                  state={rowErrors?.count ? 'error' : 'default'}
                  stateRelatedMessage={rowErrors?.count}
                  nativeInputProps={{
                    type: 'number',
                    inputMode: 'numeric',
                    min: 0,
                    step: 1,
                    value: row.count,
                    onChange: (e) => updateRow(row.accommodationId, { count: e.target.value }),
                  }}
                />
              </div>
              <div className="fr-col-12 fr-col-md-5">
                <Input
                  className="fr-mb-0"
                  label={t('rateLabel')}
                  hintText={t('rateHint')}
                  disabled={row.notMeasured || isBusy}
                  state={rowErrors?.rate ? 'error' : 'default'}
                  stateRelatedMessage={rowErrors?.rate}
                  nativeInputProps={{
                    type: 'number',
                    inputMode: 'numeric',
                    min: 0,
                    max: 100,
                    step: 1,
                    value: row.rate,
                    onChange: (e) => updateRow(row.accommodationId, { rate: e.target.value }),
                  }}
                />
              </div>
              <div className="fr-col-12 fr-col-md-2">
                <Checkbox
                  className="fr-mb-0"
                  options={[
                    {
                      label: t('notMeasured'),
                      nativeInputProps: {
                        checked: row.notMeasured,
                        disabled: isBusy,
                        onChange: (e) =>
                          updateRow(row.accommodationId, {
                            notMeasured: e.target.checked,
                            ...(e.target.checked ? { count: '', rate: '' } : {}),
                          }),
                      },
                    },
                  ]}
                />
              </div>
            </div>
          </fieldset>
        )
      })}

      <div className="fr-flex fr-justify-content-space-between fr-flex-wrap fr-flex-gap-4v fr-pt-3w">
        <Button priority="secondary" disabled={isBusy || hasErrors} onClick={() => saveMutation.mutate(answers())}>
          {t('later')}
        </Button>
        <Button
          iconId="fr-icon-arrow-right-line"
          iconPosition="right"
          disabled={isBusy || hasErrors}
          onClick={() => submitMutation.mutate(answers())}
        >
          {t('submit')}
        </Button>
      </div>

      <ScholarshipSurveyMissingModal missing={missing} dashboardHref={dashboardHref} />
    </div>
  )
}
