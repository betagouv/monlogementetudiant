'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { CreateResidenceAccommodationList } from '~/components/bailleur/details/create-residence-accommodation-list'
import { CreateResidenceEquipments } from '~/components/bailleur/details/create-residence-equipments'
import { CreateResidenceLocation } from '~/components/bailleur/details/create-residence-location'
import { CreateResidencePictures } from '~/components/bailleur/details/create-residence-pictures'
import { CreateResidencePublication } from '~/components/bailleur/details/create-residence-publication'
import { ResidenceDetails } from '~/components/bailleur/details/residence-details'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { ResidenceVirtualTour } from '~/components/bailleur/details/residence-virtual-tour'
import { useCreateResidence } from '~/hooks/use-create-residence'
import { trackEvent } from '~/lib/tracking'
import { createZCreateResidence, TCreateResidence } from '~/schemas/accommodations/create-residence'
import { buildHref } from '~/utils/preserve-query-params'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './update-residence-form.module.css'

export const CreateResidenceForm = () => {
  const t = useTranslations('bailleur.residences.details.form')
  const tSchemas = useTranslations('schemas')
  const schema = useMemo(() => createZCreateResidence(tSchemas), [tSchemas])
  const createMutation = useCreateResidence()
  const searchParams = useSearchParams()

  const form = useForm<TCreateResidence>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      residenceType: '' as TCreateResidence['residenceType'],
      targetAudience: '' as TCreateResidence['targetAudience'],
      description: '',
      rentalChargesDetails: '',
      externalUrl: '',
      virtualTourUrl: '',
      acceptWaitingList: false,
      typologies: [
        {
          type: '' as TCreateResidence['typologies'][number]['type'],
          priceMin: undefined as unknown as number,
          priceMax: undefined as unknown as number,
          colocation: false,
          nbTotal: undefined as unknown as number,
          nbAvailable: undefined as unknown as number,
        },
      ],
      refrigerator: false,
      laundryRoom: false,
      bathroom: undefined,
      kitchenType: undefined,
      microwave: false,
      secureAccess: false,
      parking: false,
      commonAreas: false,
      bikeStorage: false,
      desk: false,
      residenceManager: false,
      cookingPlates: false,
      imagesUrls: [],
      imagesFiles: [],
      published: true,
      scholarshipHoldersPriority: false,
      socialHousingRequired: false,
      nbAccessibleApartments: null,
      nbColivingApartments: null,
      addresses: [{ address: '', city: '', postalCode: '' }],
    },
  })

  const onSubmit = async (data: TCreateResidence) => {
    await createMutation.mutateAsync({
      ...data,
      description: data.description ? sanitizeHTML(data.description) : data.description,
    })
    trackEvent({ category: 'Espace Gestionnaire', action: 'creation residence', name: data.name })
  }

  return (
    <FormProvider {...form}>
      {/* noValidate : la validation est assurée par Zod/RHF. La validation native du navigateur
          court-circuiterait le resolver et remplacerait les messages DSFR par ses propres bulles. */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-align-items-center">
          <h1>{t('newTitle')}</h1>
          <CreateResidencePublication />
        </div>
        <div className="fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
          <div className={clsx(styles.container, 'fr-col-md-8 boxShadow')}>
            <ResidenceDetails />
            <CreateResidencePictures />
            <ResidenceVirtualTour />
            <CreateResidenceAccommodationList />
            <CreateResidenceEquipments />
            <ResidenceSummary />
            <CreateResidenceLocation />
          </div>
          <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full boxShadow')}>
            <ResidenceRedirection />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-center fr-p-2w fr-p-md-4w">
              <Button type="submit" iconId="ri-add-line" disabled={createMutation.isPending}>
                {t('create')}
              </Button>
              <Button priority="secondary" linkProps={{ href: buildHref('/bailleur/residences', searchParams) }}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
