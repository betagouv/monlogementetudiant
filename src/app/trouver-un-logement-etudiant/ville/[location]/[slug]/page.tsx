import { RiIconClassName, fr } from '@codegouvfr/react-dsfr'
import { Tag, TagProps } from '@codegouvfr/react-dsfr/Tag'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { AccommodationAvailability } from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-availability'
import AccommodationDescription from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-description'
import { AccommodationEquipments } from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-equipments'
import { AccommodationLocalisation } from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-localisation'
import AccommodationMap from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-map'
import { AccommodationResidence } from '~/app/trouver-un-logement-etudiant/ville/[location]/[slug]/accommodation-residence'
import { AccommodationImages } from '~/components/accommodation/accommodation-images'
import { NearbyAccommodations } from '~/components/accommodation/nearby-accommodations'
import { OwnerDetails } from '~/components/find-student-accomodation/owner-details/owner-details'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { getAccommodationById } from '~/server-only/get-accommodation-by-id'
import { getAccommodations } from '~/server-only/get-accommodations'
import styles from './logement.module.css'

export default async function LogementPage({ params }: { params: { slug: string } }) {
  const t = await getTranslations('accomodation')
  const commonT = await getTranslations()
  const accommodation = await getAccommodationById(params.slug)
  const { address, city, geom, available, images_urls, name, nb_total_apartments, owner, postal_code, external_url, description } =
    accommodation
  const { coordinates } = geom
  const [longitude, latitude] = coordinates
  const nearbyAccommodations = await getAccommodations({ center: `${longitude},${latitude}` })
  const tags: TagProps[] = [
    ...[
      {
        iconId: 'ri-map-pin-2-line' as RiIconClassName,
        children: city,
        linkProps: { href: `/trouver-un-logement-etudiant/ville/${city}` },
      },
    ],
    ...(accommodation.price_min ? [{ children: t('tags.priceFrom', { price: accommodation.price_min }) }] : []),
    ...(accommodation.nb_t1 || accommodation.nb_t1_bis ? [{ iconId: 'ri-user-line' as RiIconClassName, children: t('tags.studio') }] : []),
    ...(accommodation.nb_coliving_apartments ? [{ iconId: 'ri-group-line' as RiIconClassName, children: t('tags.shared') }] : []),
    ...(accommodation.nb_accessible_apartments
      ? [{ iconId: 'ri-wheelchair-line' as RiIconClassName, children: t('tags.accessible') }]
      : []),
  ]

  const breadCrumbTitle = commonT('breadcrumbs.accommodationTitle', { name, city })
  const availabilityValues = [
    accommodation.nb_t1_available,
    accommodation.nb_t1_bis_available,
    accommodation.nb_t2_available,
    accommodation.nb_t3_available,
    accommodation.nb_t4_more_available,
  ]
  const nonNullValues = availabilityValues.filter((value): value is number => value !== null && value !== undefined)
  const nbAvailable = nonNullValues.length > 0 ? nonNullValues.reduce((sum, value) => sum + value, 0) : null
  return (
    <div className={fr.cx('fr-container')}>
      <DynamicBreadcrumb title={breadCrumbTitle} />
      <h2>{t('title', { city, title: name })}</h2>
      <div className={styles.container}>
        <div className={clsx(fr.cx('fr-col-sm-8'), styles.infosContainer)}>
          {images_urls && images_urls.length > 0 && <AccommodationImages images={images_urls} title={name} />}
          <div className={styles.section}>
            <h1>{name}</h1>
            <div className={styles.tagContainer}>
              {tags.map((t) => (
                <Tag key={t.children as string} {...t}>
                  {t.children}
                </Tag>
              ))}
            </div>
          </div>
          <AccommodationAvailability nbAvailable={nbAvailable} />
          <AccommodationResidence accommodation={accommodation} />
          <AccommodationEquipments accommodation={accommodation} />
          <AccommodationLocalisation address={address} city={city} latitude={latitude} longitude={longitude} postalCode={postal_code} />
          <AccommodationDescription title={name} description={description} />
          {/* TODO: Uncomment when we want to reenable the redirection */}
          {/* <PrepareStudentLifeRedirection city={city} /> */}
        </div>
        <div className={fr.cx('fr-hidden-sm')}>{<AccommodationMap latitude={latitude} longitude={longitude} />}</div>
        <div className={fr.cx('fr-col-sm-4')}>
          <OwnerDetails
            owner={owner}
            nbAvailable={nbAvailable}
            available={available}
            nbTotalApartments={nb_total_apartments}
            externalUrl={external_url}
            title={name}
            location={city}
          />
          <NearbyAccommodations nearbyAccommodations={nearbyAccommodations} accommodation={accommodation} />
        </div>
      </div>
    </div>
  )
}
