import { fr, RiIconClassName } from '@codegouvfr/react-dsfr'
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Tag, TagProps } from '@codegouvfr/react-dsfr/Tag'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AccommodationAvailability } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-availability'
import AccommodationDescription from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-description'
import { AccommodationEquipments } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-equipments'
import { AccommodationLocalisation } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-localisation'
import AccommodationMap from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { AccommodationResidence } from '~/app/(public)/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-residence'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { NearbyAccommodations } from '~/components/accommodation/nearby-accommodations'
import { SaveAccommodationFavoriteButton } from '~/components/favorites/save-accommodation-favorite-button'
import { OwnerDetails } from '~/components/find-student-accomodation/owner-details/owner-details'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories } from '~/schemas/territories'
import { getAccommodationById } from '~/server-only/get-accommodation-by-id'
import { getAccommodations } from '~/server-only/get-accommodations'
import { getCityDetails } from '~/server-only/get-city-details'
import { getTerritories } from '~/server-only/get-territories'
import { getFavorites } from '~/server-only/student/get-favorites'
import { calculateAvailability } from '~/utils/calculateAvailability'
import { formatCityWithA } from '~/utils/french-contraction'
import styles from './logement.module.css'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; location: string }> }): Promise<Metadata> {
  const t = await getTranslations('metadata')
  const { slug } = await params
  const accommodation = await getAccommodationById(slug)
  const cityFormatted = formatCityWithA(accommodation.city)
  return {
    title: t('accommodation.title', { name: accommodation.name, cityFormatted }),
    description: t('accommodation.description', { name: accommodation.name, cityFormatted }),
  }
}

export default async function AccommodationPage({ params }: { params: Promise<{ slug: string; location: string }> }) {
  const t = await getTranslations('accomodation')
  const commonT = await getTranslations()
  const { slug, location } = await params
  const accommodation = await getAccommodationById(slug)
  const decodedLocationUri = decodeURIComponent(location)
  const favorites = await getFavorites()
  const territories = await getTerritories(decodedLocationUri)
  const territory = (territories.cities || []).find(
    (territory) => territory.name === decodedLocationUri || territory.slug === decodedLocationUri,
  ) as TTerritories['cities'][0]
  const cityDetails = await getCityDetails(territory.slug)
  const cityBbox = expandBbox(cityDetails.bbox.xmin, cityDetails.bbox.ymin, cityDetails.bbox.xmax, cityDetails.bbox.ymax)

  const {
    address,
    city,
    geom,
    available,
    images_urls,
    name,
    nb_total_apartments,
    owner,
    postal_code,
    external_url,
    description,
    accept_waiting_list,
  } = accommodation
  const { coordinates } = geom
  const [longitude, latitude] = coordinates
  const nearbyAccommodations = await getAccommodations({ center: `${longitude},${latitude}` })
  const citySearchUrl = `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}?vue=carte&bbox=${cityBbox.west},${cityBbox.south},${cityBbox.east},${cityBbox.north}`
  const tags: TagProps[] = [
    ...[
      {
        iconId: 'ri-map-pin-2-line' as RiIconClassName,
        children: city,
        linkProps: { href: citySearchUrl },
      },
    ],
    ...(accommodation.price_min ? [{ children: t('tags.priceFrom', { price: accommodation.price_min }) }] : []),
    ...(accommodation.nb_t1 || accommodation.nb_t1_bis ? [{ iconId: 'ri-user-line' as RiIconClassName, children: t('tags.studio') }] : []),
    ...(accommodation.nb_coliving_apartments ? [{ iconId: 'ri-group-line' as RiIconClassName, children: t('tags.shared') }] : []),
    ...(accommodation.nb_accessible_apartments
      ? [{ iconId: 'ri-wheelchair-line' as RiIconClassName, children: t('tags.accessible') }]
      : []),
  ]

  const cityFormatted = formatCityWithA(city)
  const breadCrumbTitle = commonT('breadcrumbs.accommodationTitle', { name, cityFormatted })
  const nbAvailable = calculateAvailability({
    nb_t1_available: accommodation.nb_t1_available,
    nb_t1_bis_available: accommodation.nb_t1_bis_available,
    nb_t2_available: accommodation.nb_t2_available,
    nb_t3_available: accommodation.nb_t3_available,
    nb_t4_available: accommodation.nb_t4_available,
    nb_t5_available: accommodation.nb_t5_available,
    nb_t6_available: accommodation.nb_t6_available,
    nb_t7_more_available: accommodation.nb_t7_more_available,
  })
  return (
    <div className={fr.cx('fr-container')}>
      <Breadcrumb
        currentPageLabel={breadCrumbTitle}
        homeLinkProps={{ href: '/' }}
        segments={[
          {
            label: commonT('breadcrumbs.findAccomodationWithLocation', { locationFormatted: formatCityWithA(city) }),
            linkProps: {
              href: `/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}?vue=carte&bbox=${cityBbox.west},${cityBbox.south},${cityBbox.east},${cityBbox.north}`,
            },
          },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <h1 className="fr-h2">{t('title', { cityFormatted, title: name })}</h1>
        <SaveAccommodationFavoriteButton slug={slug} withLabel initialFavorites={favorites} />
      </div>
      <div className={styles.container}>
        <div className={styles.infosContainer}>
          {images_urls && images_urls.length > 0 && <AccommodationImages images={images_urls} title={name} />}
          <div className={styles.section}>
            <h2>{name}</h2>
            <div className={styles.tagContainer}>
              {tags.map((t) => (
                <Tag key={t.children as string} {...t}>
                  {t.children}
                </Tag>
              ))}
            </div>
          </div>
          <AccommodationAvailability nbAvailable={nbAvailable} acceptWaitingList={accept_waiting_list} />
          <AccommodationResidence accommodation={accommodation} />
          <AccommodationEquipments accommodation={accommodation} />
          <AccommodationLocalisation address={address} city={city} latitude={latitude} longitude={longitude} postalCode={postal_code} />
          <AccommodationDescription title={name} description={description} />
          {/* TODO: Uncomment when we want to reenable the redirection */}
          {/* <PrepareStudentLifeRedirection city={city} /> */}
        </div>
        <div className={fr.cx('fr-hidden-sm')}>{<AccommodationMap latitude={latitude} longitude={longitude} />}</div>
        <div className={styles.stickyColumn}>
          <OwnerDetails
            acceptWaitingList={accept_waiting_list}
            owner={owner}
            nbAvailable={nbAvailable}
            available={available}
            nbTotalApartments={nb_total_apartments}
            externalUrl={external_url}
            title={name}
            location={city}
            slug={slug}
          />
          <NearbyAccommodations nearbyAccommodations={nearbyAccommodations} accommodation={accommodation} />
        </div>
      </div>
    </div>
  )
}
