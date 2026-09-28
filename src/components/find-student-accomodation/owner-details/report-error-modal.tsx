'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'
import { ModalPortal } from '~/components/ui/modal-portal'
import { RequiredLabel } from '~/components/ui/required-mark'
import { EAccommodationReportField } from '~/enums/accommodation-report-field'
import { trackEvent } from '~/lib/tracking'
import {
  REPORT_DETAILS_MAX_LENGTH,
  reportAccommodationFormDefaults,
  TReportAccommodationForm,
  ZReportAccommodationForm,
} from '~/schemas/accommodations/report-accommodation'
import { useTRPC } from '~/server/trpc/client'

const FIELD_OPTIONS = [
  { value: EAccommodationReportField.AVAILABILITY, labelKey: 'fields.availability' },
  { value: EAccommodationReportField.PRICE, labelKey: 'fields.price' },
  { value: EAccommodationReportField.OTHER, labelKey: 'fields.other' },
] as const

export const ReportErrorButton = ({ accommodationSlug }: { accommodationSlug: string }) => {
  const t = useTranslations('accomodation.sidebar.report')
  const trpc = useTRPC()
  const modal = useMemo(() => createModal({ id: `report-error-modal-${accommodationSlug}`, isOpenedByDefault: false }), [accommodationSlug])
  const [step, setStep] = useState<'form' | 'success'>('form')

  const form = useForm<TReportAccommodationForm>({
    resolver: zodResolver(ZReportAccommodationForm),
    defaultValues: reportAccommodationFormDefaults,
  })

  const { mutate, isPending } = useMutation(
    trpc.accommodations.report.mutationOptions({
      onSuccess: (_, { field }) => {
        trackEvent({ category: 'Logement', action: 'signaler une erreur', name: `${accommodationSlug} - ${field}` })
        setStep('success')
      },
      onError: (error) =>
        createToast({ priority: 'error', message: error.data?.code === 'TOO_MANY_REQUESTS' ? error.message : t('error') }),
    }),
  )

  const handleClose = () => {
    modal.close()
    setStep('form')
    form.reset(reportAccommodationFormDefaults)
  }

  const handleSubmit = form.handleSubmit((data) => mutate({ slug: accommodationSlug, ...data }))
  const { errors } = form.formState

  return (
    <>
      <button type="button" className="fr-link fr-text--xs fr-mb-0" {...modal.buttonProps}>
        {t('trigger')}
      </button>
      <ModalPortal>
        <modal.Component title={t('title')}>
          {step === 'form' ? (
            <form onSubmit={handleSubmit} noValidate>
              <RadioButtons
                legend={<RequiredLabel>{t('fieldLegend')}</RequiredLabel>}
                state={errors.field ? 'error' : 'default'}
                stateRelatedMessage={errors.field?.message}
                options={FIELD_OPTIONS.map(({ value, labelKey }) => ({
                  label: t(labelKey),
                  nativeInputProps: { ...form.register('field'), value },
                }))}
              />
              <Input
                label={t('detailsLabel')}
                textArea
                state={errors.details ? 'error' : 'default'}
                stateRelatedMessage={errors.details?.message}
                nativeTextAreaProps={{ ...form.register('details'), rows: 4, maxLength: REPORT_DETAILS_MAX_LENGTH }}
              />
              <div className="fr-flex fr-justify-content-end fr-flex-gap-4v">
                <Button type="button" priority="secondary" onClick={handleClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t('submit')}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Alert severity="success" small description={t('success')} className="fr-mb-3w" />
              <div className="fr-flex fr-justify-content-end">
                <Button type="button" onClick={handleClose}>
                  {t('close')}
                </Button>
              </div>
            </>
          )}
        </modal.Component>
      </ModalPortal>
    </>
  )
}
