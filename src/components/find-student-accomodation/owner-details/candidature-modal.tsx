'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/Select'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { ModalPortal } from '~/components/ui/modal-portal'
import type { ApartmentType } from '~/enums/apartment-type'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

interface CandidatureModalProps {
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
}

export const useCandidatureModal = (accommodationSlug: string) => {
  return useMemo(() => createModal({ id: `candidature-modal-${accommodationSlug}`, isOpenedByDefault: false }), [accommodationSlug])
}

export const CandidatureModal = ({ accommodationSlug, availableApartmentTypes }: CandidatureModalProps) => {
  const t = useTranslations('accomodation.candidatureModal')
  const tApartmentTypes = useTranslations('shared.apartmentTypes')
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [selectedApartmentType, setSelectedApartmentType] = useState<ApartmentType | ''>('')
  const modal = useCandidatureModal(accommodationSlug)

  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const applyMutation = useMutation({
    mutationFn: (apartmentType: ApartmentType) => trpcClient.dossierFacile.application.mutate({ accommodationSlug, apartmentType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.dossierFacile.listApplications.queryKey({ accommodationSlug }) })
      setStep('success')
    },
  })

  const handleSubmit = () => {
    if (selectedApartmentType) {
      applyMutation.mutate(selectedApartmentType)
    }
  }

  const handleClose = () => {
    modal.close()
    setStep('form')
    setSelectedApartmentType('')
  }

  return (
    <ModalPortal>
      <modal.Component
        titleAs="h2"
        title={step === 'form' ? t('title') : t('successTitle')}
        buttons={
          step === 'form'
            ? [
                {
                  children: t('cancel'),
                  priority: 'secondary',
                  doClosesModal: true,
                  onClick: handleClose,
                },
                {
                  children: t('submit'),
                  doClosesModal: false,
                  onClick: handleSubmit,
                  disabled: !selectedApartmentType || applyMutation.isPending,
                },
              ]
            : [
                {
                  children: t('close'),
                  doClosesModal: true,
                  onClick: handleClose,
                },
              ]
        }
      >
        {step === 'form' ? (
          <Select
            label={t('apartmentTypeLabel')}
            nativeSelectProps={{
              value: selectedApartmentType,
              onChange: (e) => setSelectedApartmentType(e.target.value as ApartmentType),
            }}
          >
            <option value="" disabled hidden>
              {t('apartmentTypePlaceholder')}
            </option>
            {availableApartmentTypes.map((type) => (
              <option key={type} value={type}>
                {tApartmentTypes(type)}
              </option>
            ))}
          </Select>
        ) : (
          <p>{t('successDescription')}</p>
        )}
      </modal.Component>
    </ModalPortal>
  )
}
