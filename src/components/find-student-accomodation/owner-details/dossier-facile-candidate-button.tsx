'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Select from '@codegouvfr/react-dsfr/Select'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import z from 'zod'
import { APARTMENT_TYPE_LABELS, type ApartmentType } from '~/enums/apartment-type'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

interface Props {
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
  isAuthenticated: boolean
  acceptDossierFacile: boolean
}

export const DossierFacileLinkButton = ({ accommodationSlug, availableApartmentTypes, isAuthenticated, acceptDossierFacile }: Props) => {
  const t = useTranslations('accomodation')
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<ApartmentType | ''>('')

  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    ...trpc.dossierFacile.tenant.queryOptions(),
    enabled: isAuthenticated,
  })

  const { data: application, isLoading: isApplicationLoading } = useQuery({
    ...trpc.dossierFacile.listApplications.queryOptions({ accommodationSlug }),
    enabled: isAuthenticated && !!tenant,
  })

  const applyMutation = useMutation({
    mutationFn: (apartmentType: ApartmentType) => trpcClient.dossierFacile.application.mutate({ accommodationSlug, apartmentType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.dossierFacile.listApplications.queryKey({ accommodationSlug }) })
    },
  })

  const handleConnect = async () => {
    trackEvent({ category: 'Dossier Facile', action: 'Candidater avec Dossier Facile' })
    const { authorizationUrl } = await trpcClient.dossierFacile.connectUrl.mutate({
      returnTo: window.location.pathname + window.location.search,
    })
    window.location.href = authorizationUrl
  }

  const handleApply = () => {
    const type = availableApartmentTypes.length === 1 ? availableApartmentTypes[0] : selectedType
    if (!type) return
    applyMutation.mutate(type)
  }

  const tenantUrl = tenant?.url ?? z.string().parse(process.env.NEXT_PUBLIC_DOSSIERFACILE_LOCATAIRE_URL)

  if (!isAuthenticated || !acceptDossierFacile) return null

  if (isTenantLoading || isApplicationLoading) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          ...
        </Button>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button onClick={handleConnect} priority="primary" className="fr-width-full fr-flex fr-justify-content-center">
          {t('sidebar.buttons.dossierFacileConnect')}
        </Button>
        <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.dossierFacileConnectDescription')}</span>
      </div>
    )
  }

  if (tenant.status === 'access_revoked' || tenant.status === 'inactive') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button onClick={handleConnect} priority="primary" className="fr-width-full fr-flex fr-justify-content-center">
          {t('sidebar.buttons.dossierFacileConnect')}
        </Button>
        <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.dossierFacileConnectDescription')}</span>
      </div>
    )
  }

  if (tenant.status === 'incomplete') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button
          priority="primary"
          className="fr-width-full fr-flex fr-justify-content-center"
          linkProps={{ href: tenantUrl, target: '_blank', rel: 'noopener noreferrer' }}
        >
          {t('sidebar.buttons.dossierFacileIncomplete')}
        </Button>
      </div>
    )
  }

  if (tenant.status === 'denied') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button
          priority="primary"
          className="fr-width-full fr-flex fr-justify-content-center"
          linkProps={{ href: tenantUrl, target: '_blank', rel: 'noopener noreferrer' }}
        >
          {t('sidebar.buttons.dossierFacileDenied')}
        </Button>
      </div>
    )
  }

  if (tenant.status !== 'verified') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t('sidebar.buttons.dossierFacilePending')}
        </Button>
      </div>
    )
  }

  if (application) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t('sidebar.buttons.dossierFacileApplied')}
        </Button>
      </div>
    )
  }

  if (availableApartmentTypes.length === 0) return null

  return (
    <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
      {availableApartmentTypes.length > 1 && (
        <Select
          label={t('sidebar.buttons.dossierFacileSelectType')}
          nativeSelectProps={{
            value: selectedType,
            onChange: (e) => setSelectedType(e.target.value as ApartmentType | ''),
          }}
          className="fr-width-full fr-mb-1w"
        >
          <option value="" disabled hidden>
            {t('sidebar.buttons.dossierFacileSelectType')}
          </option>
          {availableApartmentTypes.map((type) => (
            <option key={type} value={type}>
              {APARTMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      )}
      <Button
        onClick={handleApply}
        priority="primary"
        className="fr-width-full fr-flex fr-justify-content-center"
        disabled={applyMutation.isPending || (availableApartmentTypes.length > 1 && !selectedType)}
      >
        {applyMutation.isPending ? '...' : t('sidebar.buttons.dossierFacileApply')}
      </Button>
      <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.dossierFacileDescription')}</span>
    </div>
  )
}
