'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { FormProvider, useForm } from 'react-hook-form'
import { CreateResidenceAccommodationList } from '~/components/bailleur/details/create-residence-accommodation-list'
import { CreateResidenceLocation } from '~/components/bailleur/details/create-residence-location'
import { ResidenceEquipments } from '~/components/bailleur/details/residence-equipments'
import { ResidenceDetails } from '~/components/bailleur/details/residence-parametrage'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { useCreateResidence } from '~/hooks/use-create-residence'
import { TCreateResidence, ZCreateResidence } from '~/schemas/accommodations/create-residence'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './update-residence-form.module.css'

export const CreateResidenceForm = () => {
  const createMutation = useCreateResidence()

  const form = useForm<TCreateResidence>({
    resolver: zodResolver(ZCreateResidence),
    defaultValues: {
      name: '',
      description: '',
      external_url: '',
      accept_waiting_list: false,
      nb_t1: null,
      nb_t1_bis: null,
      nb_t2: null,
      nb_t3: null,
      nb_t4: null,
      nb_t5: null,
      nb_t6: null,
      nb_t7_more: null,
      nb_t1_available: null,
      nb_t1_bis_available: null,
      nb_t2_available: null,
      nb_t3_available: null,
      nb_t4_available: null,
      nb_t5_available: null,
      nb_t6_available: null,
      nb_t7_more_available: null,
      price_min_t1: null,
      price_max_t1: null,
      price_min_t1_bis: null,
      price_max_t1_bis: null,
      price_min_t2: null,
      price_max_t2: null,
      price_min_t3: null,
      price_max_t3: null,
      price_min_t4: null,
      price_max_t4: null,
      price_min_t5: null,
      price_max_t5: null,
      price_min_t6: null,
      price_max_t6: null,
      price_min_t7_more: null,
      price_max_t7_more: null,
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
      published: false,
      scholarship_holders_priority: false,
      nb_accessible_apartments: null,
      address: '',
      city: '',
      postal_code: '',
      longitude: undefined as unknown as number,
      latitude: undefined as unknown as number,
    },
  })

  const onSubmit = async (data: TCreateResidence) => {
    const sanitizedData = {
      ...data,
      description: data.description ? sanitizeHTML(data.description) : data.description,
    }
    await createMutation.mutateAsync(sanitizedData)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <h1>Nouvelle résidence</h1>
        <div className="fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
          <div className={clsx(styles.container, 'fr-col-md-8')}>
            <ResidenceDetails />
            <CreateResidenceLocation />
            <CreateResidenceAccommodationList />
            <ResidenceEquipments />
            <ResidenceSummary />
          </div>
          <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full')}>
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
