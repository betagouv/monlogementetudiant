'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { FormProvider, useForm } from 'react-hook-form'
import { ResidenceAccommodationList } from '~/components/bailleur/details/residence-accommodation-list'
import { ResidenceDetails } from '~/components/bailleur/details/residence-details'
import { ResidenceEquipments } from '~/components/bailleur/details/residence-equipments'
import { ResidenceLocation } from '~/components/bailleur/details/residence-location'
import { ResidencePictures } from '~/components/bailleur/details/residence-pictures'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { UpdateResidencePublication } from '~/components/bailleur/details/update-residence-publication'
import { useUpdateResidenceDetails } from '~/hooks/use-update-residence-details'
import { trackEvent } from '~/lib/tracking'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { createUpdateResidenceSchema, EResidenceType, ETargetAudience, TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { sanitizeHTML } from '~/utils/sanitize-html'
import styles from './update-residence-form.module.css'

export const UpdateResidenceForm = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const { properties } = accommodation
  const { city } = properties
  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accommodation.properties.slug}`

  const updateMutation = useUpdateResidenceDetails(accommodation.properties.slug)

  const form = useForm<TUpdateResidence>({
    resolver: zodResolver(
      createUpdateResidenceSchema({
        nb_t1: accommodation.properties.nb_t1,
        nb_t1_bis: accommodation.properties.nb_t1_bis,
        nb_t2: accommodation.properties.nb_t2,
        nb_t3: accommodation.properties.nb_t3,
        nb_t4: accommodation.properties.nb_t4,
        nb_t5: accommodation.properties.nb_t5,
        nb_t6: accommodation.properties.nb_t6,
        nb_t7_more: accommodation.properties.nb_t7_more,
      }),
    ),
    defaultValues: {
      name: accommodation.properties.name || '',
      residence_type: (accommodation.properties.residence_type as EResidenceType) || '',
      target_audience: (accommodation.properties.target_audience as ETargetAudience) || '',
      address: accommodation.properties.address || '',
      city: accommodation.properties.city || '',
      postal_code: accommodation.properties.postal_code || '',
      description: accommodation.properties.description || '',
      external_url: accommodation.properties.external_url || '',
      accept_waiting_list: accommodation.properties.accept_waiting_list || false,

      nb_t1: accommodation.properties.nb_t1 ?? null,
      nb_t1_available: accommodation.properties.nb_t1_available ?? null,
      nb_t1_bis: accommodation.properties.nb_t1_bis ?? null,
      nb_t1_bis_available: accommodation.properties.nb_t1_bis_available ?? null,
      nb_t2: accommodation.properties.nb_t2 ?? null,
      nb_t2_available: accommodation.properties.nb_t2_available ?? null,
      nb_t3: accommodation.properties.nb_t3 ?? null,
      nb_t3_available: accommodation.properties.nb_t3_available ?? null,
      nb_t4: accommodation.properties.nb_t4 ?? null,
      nb_t4_available: accommodation.properties.nb_t4_available ?? null,
      nb_t5: accommodation.properties.nb_t5 ?? null,
      nb_t5_available: accommodation.properties.nb_t5_available ?? null,
      nb_t6: accommodation.properties.nb_t6 ?? null,
      nb_t6_available: accommodation.properties.nb_t6_available ?? null,
      nb_t7_more: accommodation.properties.nb_t7_more ?? null,
      nb_t7_more_available: accommodation.properties.nb_t7_more_available ?? null,

      price_min_t1: accommodation.properties.price_min_t1 || null,
      price_max_t1: accommodation.properties.price_max_t1 || null,
      price_min_t1_bis: accommodation.properties.price_min_t1_bis || null,
      price_max_t1_bis: accommodation.properties.price_max_t1_bis || null,
      price_min_t2: accommodation.properties.price_min_t2 || null,
      price_max_t2: accommodation.properties.price_max_t2 || null,
      price_min_t3: accommodation.properties.price_min_t3 || null,
      price_max_t3: accommodation.properties.price_max_t3 || null,
      price_min_t4: accommodation.properties.price_min_t4 || null,
      price_max_t4: accommodation.properties.price_max_t4 || null,
      price_min_t5: accommodation.properties.price_min_t5 || null,
      price_max_t5: accommodation.properties.price_max_t5 || null,
      price_min_t6: accommodation.properties.price_min_t6 || null,
      price_max_t6: accommodation.properties.price_max_t6 || null,
      price_min_t7_more: accommodation.properties.price_min_t7_more || null,
      price_max_t7_more: accommodation.properties.price_max_t7_more || null,

      superficie_min_t1: accommodation.properties.superficie_min_t1 ?? null,
      superficie_max_t1: accommodation.properties.superficie_max_t1 ?? null,
      superficie_min_t1_bis: accommodation.properties.superficie_min_t1_bis ?? null,
      superficie_max_t1_bis: accommodation.properties.superficie_max_t1_bis ?? null,
      superficie_min_t2: accommodation.properties.superficie_min_t2 ?? null,
      superficie_max_t2: accommodation.properties.superficie_max_t2 ?? null,
      superficie_min_t3: accommodation.properties.superficie_min_t3 ?? null,
      superficie_max_t3: accommodation.properties.superficie_max_t3 ?? null,
      superficie_min_t4: accommodation.properties.superficie_min_t4 ?? null,
      superficie_max_t4: accommodation.properties.superficie_max_t4 ?? null,
      superficie_min_t5: accommodation.properties.superficie_min_t5 ?? null,
      superficie_max_t5: accommodation.properties.superficie_max_t5 ?? null,
      superficie_min_t6: accommodation.properties.superficie_min_t6 ?? null,
      superficie_max_t6: accommodation.properties.superficie_max_t6 ?? null,
      superficie_min_t7_more: accommodation.properties.superficie_min_t7_more ?? null,
      superficie_max_t7_more: accommodation.properties.superficie_max_t7_more ?? null,

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
      published: accommodation.properties.published,
      scholarship_holders_priority: accommodation.properties.scholarship_holders_priority || false,
      social_housing_required: accommodation.properties.social_housing_required || false,
      nb_accessible_apartments: accommodation.properties.nb_accessible_apartments || null,
      nb_coliving_apartments: accommodation.properties.nb_coliving_apartments || null,
    },
  })

  const onSubmit = async (data: TUpdateResidence) => {
    const sanitizedData = {
      ...data,
      description: data.description ? sanitizeHTML(data.description) : data.description,
    }
    await updateMutation.mutateAsync(sanitizedData)
    trackEvent({ category: 'Espace Gestionnaire', action: 'mise a jour residence', name: accommodation.properties.slug })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-align-items-md-center fr-flex-gap-4v">
          <div className="fr-flex fr-flex-gap-2v fr-align-items-center">
            <h1 className="fr-mb-0">{accommodation.properties.name}</h1>
            <Tag>{`${city} (${accommodation.properties.postal_code})`}</Tag>
          </div>
          <UpdateResidencePublication onSubmit={onSubmit} slug={accommodation.properties.slug} />
        </div>
        <div className="fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
          <div className={clsx(styles.container, 'fr-col-md-8 boxShadow')}>
            <ResidenceDetails />
            <ResidencePictures accommodation={accommodation} />
            <ResidenceAccommodationList accommodation={accommodation} />
            <ResidenceEquipments />
            <ResidenceSummary />
            <ResidenceLocation accommodation={accommodation} />
          </div>
          <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full boxShadow')}>
            <div className="fr-flex fr-justify-content-center fr-p-6w">
              <span className="fr-mb-0 fr-text--xs">Dernière modification {formatRelativeTime(accommodation.properties.updated_at)}</span>
            </div>
            <ResidenceRedirection className="fr-border-top" />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-center fr-p-2w fr-p-md-4w">
              <Button type="submit" iconId="ri-save-line" disabled={updateMutation.isPending}>
                Enregistrer
              </Button>
              <Button
                priority="secondary"
                linkProps={{
                  href: redirectUri,
                  target: '_blank',
                  onClick: () =>
                    trackEvent({ category: 'Espace Gestionnaire', action: 'decouvrir-offre', name: accommodation.properties.slug }),
                }}
              >
                Voir la fiche
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
