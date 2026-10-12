'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import ButtonsGroup from '@codegouvfr/react-dsfr/ButtonsGroup'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createToast } from '~/components/ui/createToast'
import { getTypologyLabel } from '~/schemas/accommodations/typology'
import { useTRPC } from '~/server/trpc/client'

const RESIDENCES_HREF = '/bailleur/residences'

export const ConfirmAvailability = () => {
  const t = useTranslations('bailleur.confirmAvailability')
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState<number | null>(null)

  const { data: residences, isPending: isLoading } = useQuery(trpc.bailleur.listAvailabilityToConfirm.queryOptions())
  const { mutate, isPending } = useMutation(
    trpc.bailleur.confirmAvailability.mutationOptions({
      onSuccess: async (result) => {
        setConfirmed(result.confirmed)
        await queryClient.invalidateQueries({ queryKey: trpc.bailleur.listAvailabilityToConfirm.queryKey() })
      },
      onError: () => createToast({ priority: 'error', message: t('error') }),
    }),
  )

  if (confirmed !== null) {
    return (
      <>
        <Alert severity="success" title={t('successTitle', { count: confirmed })} description={t('successDescription')} />
        <Button className="fr-mt-4w" priority="secondary" linkProps={{ href: RESIDENCES_HREF }}>
          {t('backToResidences')}
        </Button>
      </>
    )
  }

  if (isLoading) return null

  if (!residences?.length) {
    return (
      <>
        <Alert severity="info" title={t('emptyTitle')} description={t('emptyDescription')} />
        <Button className="fr-mt-4w" priority="secondary" linkProps={{ href: RESIDENCES_HREF }}>
          {t('backToResidences')}
        </Button>
      </>
    )
  }

  return (
    <>
      <p>{t('intro')}</p>
      <ul className="fr-mb-4w">
        {residences.map((residence) => (
          <li key={residence.id} className="fr-mb-2w">
            <strong>{residence.name}</strong>
            <ul>
              {residence.typologies.map((typology) => (
                <li key={typology.type}>
                  {typology.nbTotal === null
                    ? t('typologyNoTotal', { label: getTypologyLabel(typology.type), available: typology.nbAvailable ?? 0 })
                    : t('typology', {
                        label: getTypologyLabel(typology.type),
                        available: typology.nbAvailable ?? 0,
                        total: typology.nbTotal,
                      })}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <ButtonsGroup
        inlineLayoutWhen="md and up"
        buttons={[
          { children: t('confirm'), iconId: 'ri-check-line', disabled: isPending, onClick: () => mutate() },
          { children: t('update'), priority: 'secondary', linkProps: { href: RESIDENCES_HREF } },
        ]}
      />
    </>
  )
}
