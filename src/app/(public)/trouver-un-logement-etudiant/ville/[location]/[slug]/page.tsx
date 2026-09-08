export const dynamic = 'force-dynamic'
export const revalidate = 0

import { RiIconClassName } from '@codegouvfr/react-dsfr'
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Tag, TagProps } from '@codegouvfr/react-dsfr/Tag'
import { HydrationBoundary } from '@tanstack/react-query'
import clsx from 'clsx'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AccommodationAvailability } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-availability'
import AccommodationDescription from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-description'
import { AccommodationEquipments } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-equipments'
import { AccommodationLocalisation } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-localisation'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { AccommodationNearbyEtablissements } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-nearby-etablissements'
import { AccommodationResidence } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-residence'
import { AccommodationVirtualTour } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-virtual-tour'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { NearbyAccommodations } from '~/components/accommodation/nearby-accommodations'
import { SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import { OwnerDetails } from '~/components/find-student-accomodation/owner-details/owner-details'
import { JsonLd } from '~/components/seo/json-ld'
import { NewWindowHint } from '~/components/ui/new-window'
import { getAvailableApartmentTypes } from '~/enums/apartment-type'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { EResidenceType, RESIDENCE_TYPE_LABELS } from '~/enums/residence-type'
import { getCanonicalUrl } from '~/utils/canonical'
import { formatCityWithA } from '~/utils/french-contraction'
import { buildBreadcrumbSchema, buildLodgingSchema } from '~/utils/schema'
import { AccommodationViewTracker } from './accommodation-view-tracker'
import { getAccommodationBreadcrumbItems, getAccommodationLodgingData } from './get-accommodation-json-ld'
import { getAccommodationPageContext } from './get-accommodation-page-context'
import styles from './logement.module.css'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { accommodation } = await getAccommodationPageContext(slug)
  const t = await getTranslations('metadata')
  const cityFormatted = formatCityWithA(accommodation.city)

  return {
    title: t('accommodation.title', { name: accommodation.name, cityFormatted }),
    description: t('accommodation.description', { name: accommodation.name, cityFormatted }),
    // Le segment ville est décoratif dans cette route : on ancre la canonique sur le slug de la
    // ville, pour ne pas déclarer une URL différente selon le lien emprunté (nom, nom accentué…).
    alternates: { canonical: getCanonicalUrl(`/trouver-un-logement-etudiant/ville/${accommodation.citySlug}/${slug}`) },
  }
}

export default async function AccommodationPage({ params }: { params: Promise<{ slug: string; location: string }> }) {
  const t = await getTranslations('accomodation')
  const commonT = await getTranslations()
  const { slug } = await params
  const { accommodation, cityBbox, dehydratedState, latitude, longitude, nbAvailable, nearbyAccommodations, nearbyEtablissements, user } =
    await getAccommodationPageContext(slug)

  const {
    address,
    city,
    imagesUrls,
    name,
    nbTotalApartments,
    owner,
    postalCode,
    externalUrl,
    description,
    updatedAt,
    acceptWaitingList,
    virtualTourUrl,
  } = accommodation

  const citySearchUrl = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}?vue=carte&bbox=${cityBbox.west},${cityBbox.south},${cityBbox.east},${cityBbox.north}`
  const tags: TagProps[] = [
    ...[
      {
        iconId: 'ri-map-pin-2-line' as RiIconClassName,
        children: city,
        linkProps: { href: citySearchUrl },
      },
    ],
    ...(accommodation.priceMin ? [{ children: t('tags.priceFrom', { price: accommodation.priceMin }) }] : []),
    ...(accommodation.typologies.t1 || accommodation.typologies.t1_bis
      ? [{ iconId: 'ri-user-line' as RiIconClassName, children: t('tags.studio') }]
      : []),
    ...(accommodation.nbColivingApartments ? [{ iconId: 'ri-group-line' as RiIconClassName, children: t('tags.shared') }] : []),
    ...(accommodation.nbAccessibleApartments ? [{ iconId: 'ri-wheelchair-line' as RiIconClassName, children: t('tags.accessible') }] : []),
  ]

  const ownerLandingUrl = owner?.landingUrl ?? null
  const cityFormatted = formatCityWithA(city)
  const breadCrumbTitle = commonT('breadcrumbs.accommodationTitle', { name, cityFormatted })
  const isRSJAorFJT =
    accommodation.residenceType === EResidenceType.SOCIALE_JEUNES_ACTIFS ||
    accommodation.residenceType === EResidenceType.JEUNES_TRAVAILLEURS

  const addressList =
    accommodation.addresses && accommodation.addresses.length > 0
      ? accommodation.addresses
      : [{ address, city, postalCode, isMain: true, latitude, longitude }]

  const mapPositions: [number, number][] = (() => {
    const fromAddresses = addressList
      .filter((a): a is typeof a & { latitude: number; longitude: number } => a.latitude != null && a.longitude != null)
      .map((a): [number, number] => [a.latitude, a.longitude])
    return fromAddresses.length > 0 ? fromAddresses : [[latitude, longitude]]
  })()

  const breadcrumbItems = getAccommodationBreadcrumbItems(name, city, slug)
  const lodgingData = getAccommodationLodgingData({
    name,
    address,
    city,
    postalCode: postalCode,
    latitude,
    longitude,
    imagesUrls: imagesUrls,
    priceMin: accommodation.priceMin,
    priceMax: accommodation.priceMax,
    description: description ?? null,
    slug,
  })

  return (
    <HydrationBoundary state={dehydratedState}>
      <AccommodationViewTracker accommodationId={accommodation.id} />
      <JsonLd data={[buildBreadcrumbSchema(breadcrumbItems), buildLodgingSchema(lodgingData)]} />
      <div className="fr-container-md">
        <div className="fr-px-2w fr-px-md-0">
          <Breadcrumb
            currentPageLabel={breadCrumbTitle}
            homeLinkProps={{ href: '/' }}
            segments={[
              {
                label: commonT('breadcrumbs.findAccomodationWithLocation', { locationFormatted: formatCityWithA(city) }),
                linkProps: {
                  href: citySearchUrl,
                },
              },
            ]}
            classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
          />
          <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-md-start fr-mb-2w fr-mb-md-0">
            <div className="fr-col-md-10">
              <h1 className="fr-h2">{t('title', { cityFormatted, title: name })}</h1>
            </div>
            <SaveAccommodationFavoriteButton slug={slug} withLabel user={user} />
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.infosContainer}>
            {imagesUrls && imagesUrls.length > 0 && <AccommodationImages images={imagesUrls} title={name} />}
            <div className={styles.section}>
              {accommodation.residenceType && isRSJAorFJT && (
                <span className={clsx(styles.accommodationType, 'fr-text--bold fr-text--uppercase')}>
                  {RESIDENCE_TYPE_LABELS[accommodation.residenceType]}
                </span>
              )}

              <h2>{name}</h2>
              <div className={styles.tagContainer}>
                {tags.map((t) => (
                  <Tag key={t.children as string} {...t}>
                    {t.children}
                  </Tag>
                ))}
              </div>
              {owner && ownerLandingUrl && (
                <p className="fr-mt-3w fr-mb-0">
                  {t.rich('managedBy', {
                    managerName: owner.name,
                    manager: (chunks) => (
                      <a href={ownerLandingUrl} target="_blank" rel="noopener noreferrer">
                        {chunks}
                        <NewWindowHint />
                      </a>
                    ),
                  })}
                </p>
              )}
            </div>
            <AccommodationAvailability nbAvailable={nbAvailable} acceptWaitingList={acceptWaitingList} />
            <AccommodationResidence accommodation={accommodation} />
            <AccommodationVirtualTour url={virtualTourUrl} />
            <AccommodationEquipments accommodation={accommodation} />
            <AccommodationLocalisation addresses={addressList} positions={mapPositions} />
            <AccommodationNearbyEtablissements etablissements={nearbyEtablissements} />
            <AccommodationDescription title={name} description={description} />
          </div>
          <div className="fr-hidden-sm">{<AccommodationMap positions={mapPositions} />}</div>
          <div className={clsx('fr-mt-2w fr-mt-md-0 fr-px-2w fr-px-md-0', styles.stickyColumn)}>
            <OwnerDetails
              updatedAt={updatedAt}
              acceptWaitingList={acceptWaitingList}
              owner={owner}
              nbAvailable={nbAvailable}
              nbTotalApartments={nbTotalApartments}
              externalUrl={externalUrl}
              title={name}
              location={city}
              slug={slug}
              isAuthenticated={!!user}
              accommodationSlug={slug}
              availableApartmentTypes={getAvailableApartmentTypes(accommodation.typologies)}
              contactMode={owner?.contactMode ?? EOwnerContactMode.NONE}
            />
            <NearbyAccommodations nearbyAccommodations={nearbyAccommodations} accommodation={accommodation} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  )
}
