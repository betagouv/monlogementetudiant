'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { FormProvider, useForm } from 'react-hook-form'
import { ResidenceAccommodationList } from '~/components/bailleur/details/residence-accommodation-list'
import { ResidenceEquipments } from '~/components/bailleur/details/residence-equipments'
import { ResidenceLocation } from '~/components/bailleur/details/residence-location'
import { ResidenceDetails } from '~/components/bailleur/details/residence-parametrage'
import { ResidencePictures } from '~/components/bailleur/details/residence-pictures'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { useUpdateResidenceDetails } from '~/hooks/use-update-residence-details'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { TUpdateResidence, ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './update-residence-form.module.css'

export const UpdateResidenceForm = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { properties } = accommodation
  const { city } = properties
  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accommodation.properties.slug}`

  const updateMutation = useUpdateResidenceDetails(accommodation.properties.slug)

  const form = useForm<TUpdateResidence>({
    resolver: zodResolver(ZUpdateResidence),
    defaultValues: {
      name: accommodation.properties.name || '',
      description: accommodation.properties.description || '',
      external_url: accommodation.properties.external_url || '',
      accept_waiting_list: accommodation.properties.accept_waiting_list || false,
      nb_t1: accommodation.properties.nb_t1 || null,
      nb_t1_available: accommodation.properties.nb_t1_available || null,
      nb_t1_bis: accommodation.properties.nb_t1_bis || null,
      nb_t1_bis_available: accommodation.properties.nb_t1_bis_available || null,
      nb_t2: accommodation.properties.nb_t2 || null,
      nb_t2_available: accommodation.properties.nb_t2_available || null,
      nb_t3: accommodation.properties.nb_t3 || null,
      nb_t3_available: accommodation.properties.nb_t3_available || null,
      nb_t4_more: accommodation.properties.nb_t4_more || null,
      nb_t4_more_available: accommodation.properties.nb_t4_more_available || null,
      nb_total_apartments: accommodation.properties.nb_total_apartments || null,
      nb_accessible_apartments: accommodation.properties.nb_accessible_apartments || null,
      nb_coliving_apartments: accommodation.properties.nb_coliving_apartments || null,
      price_min_t1: accommodation.properties.price_min_t1 || null,
      price_max_t1: accommodation.properties.price_max_t1 || null,
      price_min_t1_bis: accommodation.properties.price_min_t1_bis || null,
      price_max_t1_bis: accommodation.properties.price_max_t1_bis || null,
      price_min_t2: accommodation.properties.price_min_t2 || null,
      price_max_t2: accommodation.properties.price_max_t2 || null,
      price_min_t3: accommodation.properties.price_min_t3 || null,
      price_max_t3: accommodation.properties.price_max_t3 || null,
      price_min_t4_more: accommodation.properties.price_min_t4_more || null,
      price_max_t4_more: accommodation.properties.price_max_t4_more || null,
      refrigerator: accommodation.properties.refrigerator || false,
      laundry_room: accommodation.properties.laundry_room || false,
      bathroom: accommodation.properties.bathroom || undefined,
      kitchen_type: accommodation.properties.kitchen_type || undefined,
      microwave: accommodation.properties.microwave || false,
      secure_access: accommodation.properties.secure_access || false,
      parking: accommodation.properties.parking || false,
      common_areas: accommodation.properties.common_areas || false,
      bike_storage: accommodation.properties.bike_storage || false,
      desk: accommodation.properties.desk || false,
      residence_manager: accommodation.properties.residence_manager || false,
      cooking_plates: accommodation.properties.cooking_plates || false,
      images_urls: accommodation.properties.images_urls || [],
    },
  })

  const onSubmit = async (data: TUpdateResidence) => {
    const sanitizedData = {
      ...data,
      description: data.description ? sanitizeHTML(data.description) : data.description,
    }
    await updateMutation.mutateAsync(sanitizedData)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-align-items-md-center fr-flex-gap-4v">
          <h1 className="fr-mb-0">{accommodation.properties.name}</h1>
          <div className="fr-flex fr-flex-gap-4v">
            <Button type="submit" iconId="ri-save-line" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button priority="secondary" linkProps={{ href: redirectUri, target: '_blank' }}>
              Voir la fiche
            </Button>
          </div>
        </div>
        <div className="fr-flex fr-direction-md-row fr-direction-column-reverse fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
          <div className={clsx(styles.container, 'fr-col-md-8')}>
            <ResidenceDetails />
            <ResidencePictures accommodation={accommodation} />
            <ResidenceAccommodationList accommodation={accommodation} />
            <ResidenceEquipments />
            <ResidenceSummary />
            <ResidenceLocation accommodation={accommodation} />
          </div>
          <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full')}>
            <div className="fr-flex fr-justify-content-center fr-p-6w">
              <span className="fr-mb-0 fr-text--xs">Dernière modification {formatRelativeTime(accommodation.properties.updated_at)}</span>
            </div>
            <ResidenceRedirection />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
