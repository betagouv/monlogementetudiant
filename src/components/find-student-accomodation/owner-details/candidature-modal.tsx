'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/Select'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { APARTMENT_TYPE_LABELS, type ApartmentType } from '~/enums/apartment-type'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const candidatureModal = createModal({
  id: 'candidature-modal',
  isOpenedByDefault: false,
})

interface CandidatureModalProps {
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
}

export const CandidatureModal = ({ accommodationSlug, availableApartmentTypes }: CandidatureModalProps) => {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [selectedApartmentType, setSelectedApartmentType] = useState<ApartmentType | ''>('')

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
    candidatureModal.close()
    setStep('form')
    setSelectedApartmentType('')
  }

  return (
    <candidatureModal.Component
      title={step === 'form' ? 'Candidater pour ce logement' : 'Candidature envoyée'}
      buttons={
        step === 'form'
          ? [
              {
                children: 'Annuler',
                priority: 'secondary',
                doClosesModal: true,
                onClick: handleClose,
              },
              {
                children: 'Candidater',
                doClosesModal: false,
                onClick: handleSubmit,
                disabled: !selectedApartmentType || applyMutation.isPending,
              },
            ]
          : [
              {
                children: 'Fermer',
                doClosesModal: true,
                onClick: handleClose,
              },
            ]
      }
    >
      {step === 'form' ? (
        <Select
          label="Type de logement"
          nativeSelectProps={{
            value: selectedApartmentType,
            onChange: (e) => setSelectedApartmentType(e.target.value as ApartmentType),
          }}
        >
          <option value="" disabled hidden>
            Sélectionnez un type de logement
          </option>
          {availableApartmentTypes.map((type) => (
            <option key={type} value={type}>
              {APARTMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      ) : (
        <p>Votre candidature a bien été envoyée. Le bailleur reviendra vers vous dans les meilleurs délais.</p>
      )}
    </candidatureModal.Component>
  )
}
