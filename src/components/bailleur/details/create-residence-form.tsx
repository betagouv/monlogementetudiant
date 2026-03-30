'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
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
import { TCreateResidence, ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './update-residence-form.module.css'

export const CreateResidenceForm = () => {
  const createMutation = useCreateResidence()

  const form = useForm<TCreateResidence>({
    resolver: zodResolver(ZCreateResidence),
    defaultValues: {
      name: '',
      residence_type: '' as TCreateResidence['residence_type'],
      target_audience: '' as TCreateResidence['target_audience'],
      description: '',
      external_url: '',
      virtual_tour_url: '',
      accept_waiting_list: false,
      typologies: [
        {
          type: '' as TCreateResidence['typologies'][number]['type'],
          price_min: undefined as unknown as number,
          price_max: undefined as unknown as number,
          colocation: false,
          nb_total: undefined as unknown as number,
          nb_available: undefined as unknown as number,
        },
      ],
      refrigerator: false,
      laundry_room: false,
      bathroom: undefined,
      kitchen_type: undefined,
      microwave: false,
      secure_access: false,
      parking: false,
      common_areas: false,
      bike_storage: false,
      desk: false,
      residence_manager: false,
      cooking_plates: false,
      images_urls: [],
      images_files: [],
      published: true,
      scholarship_holders_priority: false,
      social_housing_required: false,
      nb_accessible_apartments: null,
      nb_coliving_apartments: null,
      address: '',
      city: '',
      postal_code: '',
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
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-align-items-center">
          <h1>Nouvelle résidence</h1>
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
                Créer la résidence
              </Button>
              <Button priority="secondary" linkProps={{ href: '/bailleur/residences' }}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
