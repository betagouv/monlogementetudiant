'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { ResidenceAccommodationList } from '~/components/bailleur/details/residence-accommodation-list'
import { ResidenceDetails } from '~/components/bailleur/details/residence-details'
import { ResidenceEquipments } from '~/components/bailleur/details/residence-equipments'
import { ResidenceLocation } from '~/components/bailleur/details/residence-location'
import { ResidencePictures } from '~/components/bailleur/details/residence-pictures'
import { ResidenceRedirection } from '~/components/bailleur/details/residence-redirection'
import { ResidenceSummary } from '~/components/bailleur/details/residence-summary'
import { ResidenceVirtualTour } from '~/components/bailleur/details/residence-virtual-tour'
import { UpdateResidencePublication } from '~/components/bailleur/details/update-residence-publication'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { useUpdateResidenceDetails } from '~/hooks/use-update-residence-details'
import { trackEvent } from '~/lib/tracking'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'
import { createZUpdateResidence, TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { sanitizeHTML } from '~/utils/sanitize-html'
import { typologyFormDefaults } from '~/utils/typology-form-defaults'
import styles from './update-residence-form.module.css'

export const UpdateResidenceForm = ({ accommodation }: { accommodation: TAccomodationMy }) => {
  const t = useTranslations('bailleur.residences.details.form')
  const tSchemas = useTranslations('schemas')
  const schema = useMemo(() => createZUpdateResidence(tSchemas), [tSchemas])
  const format = useFormatter()
  const { city } = accommodation
  const redirectUri = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${accommodation.slug}`

  const updateMutation = useUpdateResidenceDetails(accommodation.slug)

  const typologyDefaults = typologyFormDefaults(accommodation.typologies)

  const form = useForm<TUpdateResidence>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: accommodation.name || '',
      residenceType: (accommodation.residenceType as EResidenceType) || '',
      targetAudience: (accommodation.targetAudience as ETargetAudience) || '',
      addresses: accommodation.addresses?.map((a) => ({
        address: a.address || '',
        city: a.city || '',
        postalCode: a.postalCode || '',
      })),
      description: accommodation.description || '',
      rentalChargesDetails: accommodation.rentalChargesDetails || '',
      externalUrl: accommodation.externalUrl || '',
      virtualTourUrl: accommodation.virtualTourUrl || '',
      acceptWaitingList: accommodation.acceptWaitingList || false,

      typologies: typologyDefaults,

      refrigerator: accommodation.refrigerator || false,
      laundryRoom: accommodation.laundryRoom || false,
      bathroom: accommodation.bathroom || undefined,
      kitchenType: accommodation.kitchenType || undefined,
      microwave: accommodation.microwave || false,
      secureAccess: accommodation.secureAccess || false,
      parking: accommodation.parking || false,
      commonAreas: accommodation.commonAreas || false,
      bikeStorage: accommodation.bikeStorage || false,
      desk: accommodation.desk || false,
      residenceManager: accommodation.residenceManager || false,
      cookingPlates: accommodation.cookingPlates || false,
      wifi: accommodation.wifi || false,
      imagesUrls: accommodation.imagesUrls || [],
      published: accommodation.published,
      scholarshipHoldersPriority: accommodation.scholarshipHoldersPriority || false,
      socialHousingRequired: accommodation.socialHousingRequired || false,
      nbAccessibleApartments: accommodation.nbAccessibleApartments ?? null,
      nbColivingApartments: accommodation.nbColivingApartments ?? null,
    },
  })

  const onSubmit = async (data: TUpdateResidence) => {
    const sanitizedData = {
      ...data,
      description: data.description && sanitizeHTML(data.description),
    }
    await updateMutation.mutateAsync(sanitizedData)
    trackEvent({ category: 'Espace Gestionnaire', action: 'mise a jour residence', name: accommodation.slug })
  }

  return (
    <FormProvider {...form}>
      {/* noValidate : la validation est assurée par Zod/RHF. La validation native du navigateur
          court-circuiterait le resolver et remplacerait les messages DSFR par ses propres bulles. */}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="fr-flex fr-direction-row fr-justify-content-space-between fr-align-items-md-center fr-flex-gap-4v">
          <div className="fr-flex fr-flex-gap-2v fr-align-items-center">
            <h1 className="fr-mb-0">{accommodation.name}</h1>
            <Tag>{`${city} (${accommodation.postalCode})`}</Tag>
          </div>
          <UpdateResidencePublication onSubmit={onSubmit} slug={accommodation.slug} />
        </div>
        <div className="fr-flex fr-direction-md-row fr-direction-column fr-justify-content-space-between fr-py-4w fr-flex-gap-4v">
          <div className={clsx(styles.container, 'fr-col-md-8 boxShadow')}>
            <ResidenceDetails />
            <ResidencePictures accommodation={accommodation} />
            <ResidenceVirtualTour />
            <ResidenceAccommodationList accommodation={accommodation} />
            <ResidenceEquipments />
            <ResidenceSummary />
            <ResidenceLocation accommodation={accommodation} />
          </div>
          <div className={clsx(styles.container, styles.stickyColumn, 'fr-width-full boxShadow')}>
            <div className="fr-flex fr-justify-content-center fr-p-6w">
              <span className="fr-mb-0 fr-text--xs">
                {t('lastModified', { time: format.relativeTime(new Date(accommodation.updatedAt), new Date()) })}
              </span>
            </div>
            <ResidenceRedirection className="fr-border-top" />
            <div className="fr-flex fr-flex-gap-4v fr-justify-content-center fr-p-2w fr-p-md-4w">
              <Button type="submit" iconId="ri-save-line" disabled={updateMutation.isPending}>
                {t('save')}
              </Button>
              <Button
                priority="secondary"
                linkProps={{
                  href: redirectUri,
                  target: '_blank',
                  onClick: () => trackEvent({ category: 'Espace Gestionnaire', action: 'decouvrir-offre', name: accommodation.slug }),
                }}
              >
                {t('viewListing')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
