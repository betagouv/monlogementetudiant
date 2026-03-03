import { z } from 'zod'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'

export enum EResidence {
  autre = 'autre',
  ecole = 'ecole',
  'foyer-soleil' = 'foyer-soleil',
  'hoteliere-sociale' = 'hoteliere-sociale',
  intergenerationnelle = 'intergenerationnelle',
  internat = 'internat',
  'jeunes-travailleurs' = 'jeunes-travailleurs',
  'mixte-actifs-etudiants' = 'mixte-actifs-etudiants',
  'service-logement' = 'service-logement',
  'service-universitaire-privee' = 'service-universitaire-privee',
  'sociale-jeunes-actifs' = 'sociale-jeunes-actifs',
  'u-crous' = 'u-crous',
  'universitaire-conventionnee' = 'universitaire-conventionnee',
}

export enum AccommodationHouseRoomType {
  private = 'private',
  shared = 'shared',
}

export const ZGeometry = z.object({
  coordinates: z.array(z.number()),
  type: z.string(),
})

const ZBaseAccommodationInfo = z.object({
  id: z.number(),
  address: z.string().max(255),
  city: z.string().max(150),
  name: z.string().max(250),
  postal_code: z.string().max(5),
  residence_type: z.nativeEnum(EResidenceType),
  target_audience: z.nativeEnum(ETargetAudience),
  slug: z.string().max(250),
  accept_waiting_list: z.boolean(),
  images_urls: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  external_url: z.string().optional(),
  updated_at: z.date(),
  published: z.boolean(),
  available: z.boolean().nullable(),
  scholarship_holders_priority: z.boolean(),
  wifi: z.boolean(),
})

const ZApartmentCounts = z.object({
  nb_accessible_apartments: z.number().nullable(),
  nb_coliving_apartments: z.number().nullable(),
  nb_total_apartments: z.number().nullable(),
  nb_t1: z.number().nullable(),
  nb_t1_bis: z.number().nullable(),
  nb_t2: z.number().nullable(),
  nb_t3: z.number().nullable(),
  nb_t4: z.number().nullable(),
  nb_t5: z.number().nullable(),
  nb_t6: z.number().nullable(),
  nb_t7_more: z.number().nullable(),
})

const ZApartmentAvailability = z.object({
  nb_t1_available: z.number().nullable(),
  nb_t1_bis_available: z.number().nullable(),
  nb_t2_available: z.number().nullable(),
  nb_t3_available: z.number().nullable(),
  nb_t4_available: z.number().nullable(),
  nb_t5_available: z.number().nullable(),
  nb_t6_available: z.number().nullable(),
  nb_t7_more_available: z.number().nullable(),
})

const ZOwnerInfo = z.object({
  owner_name: z.string().max(150).nullable(),
  owner_url: z.string().max(500).nullable(),
})

const ZPricing = z.object({
  price_min: z.number().nullable(),
  price_min_t1: z.number().nullable(),
  price_min_t1_bis: z.number().nullable(),
  price_min_t2: z.number().nullable(),
  price_min_t3: z.number().nullable(),
  price_min_t4: z.number().nullable(),
  price_min_t5: z.number().nullable(),
  price_min_t6: z.number().nullable(),
  price_min_t7_more: z.number().nullable(),
  price_max: z.number().nullable(),
  price_max_t1: z.number().nullable(),
  price_max_t1_bis: z.number().nullable(),
  price_max_t2: z.number().nullable(),
  price_max_t3: z.number().nullable(),
  price_max_t4: z.number().nullable(),
  price_max_t5: z.number().nullable(),
  price_max_t6: z.number().nullable(),
  price_max_t7_more: z.number().nullable(),
})

const ZAmenities = z.object({
  refrigerator: z.boolean().nullable(),
  laundry_room: z.boolean().nullable(),
  bathroom: z.nativeEnum(AccommodationHouseRoomType).nullable(),
  kitchen_type: z.nativeEnum(AccommodationHouseRoomType).nullable(),
  microwave: z.boolean().nullable(),
  secure_access: z.boolean().nullable(),
  parking: z.boolean().nullable(),
  common_areas: z.boolean().nullable(),
  bike_storage: z.boolean().nullable(),
  desk: z.boolean().nullable(),
  residence_manager: z.boolean().nullable(),
  cooking_plates: z.boolean().nullable(),
})

export const ZAccomodation = z.object({
  geometry: ZGeometry,
  id: z.number(),
  properties: ZBaseAccommodationInfo.extend(ZApartmentCounts.shape)
    .extend(ZApartmentAvailability.shape)
    .extend(ZOwnerInfo.shape)
    .extend(ZPricing.shape),
})

export type TAccomodation = z.infer<typeof ZAccomodation>

export const ZAccomodationCard = ZAccomodation.pick({ id: true, geometry: true, properties: true })
export type TAccomodationCard = z.infer<typeof ZAccomodationCard>

export const ZAccomodationDetails = ZBaseAccommodationInfo.extend(ZApartmentCounts.shape)
  .extend(ZApartmentAvailability.shape)
  .extend(ZPricing.shape)
  .extend(ZAmenities.shape)
  .extend({
    available: z.boolean(),
    geom: ZGeometry,
    owner: z
      .object({
        image_base64: z.string().nullable(),
        name: z.string().max(150),
        slug: z.string().max(250),
        url: z.string().max(500),
      })
      .nullable(),
    external_url: z.string().optional(),
    description: z.string().nullable(),
  })
export type TAccomodationDetails = z.infer<typeof ZAccomodationDetails>

export const ZPrepareStudentLifeAccommodationResidence = ZAccomodationDetails.pick({
  nb_t1: true,
  nb_t1_bis: true,
  nb_t2: true,
  nb_t3: true,
  nb_t4: true,
  nb_t5: true,
  nb_t6: true,
  nb_t7_more: true,
}).extend({
  location: z.string().max(250),
})
export type TPrepareStudentLifeAccommodationResidence = z.infer<typeof ZPrepareStudentLifeAccommodationResidence>

export const ZAccomodationMy = z.object({
  geometry: ZGeometry,
  properties: ZBaseAccommodationInfo.extend(ZApartmentCounts.shape)
    .extend(ZApartmentAvailability.shape)
    .extend(ZOwnerInfo.shape)
    .extend(ZPricing.shape)
    .extend(ZAmenities.shape),
})
export type TAccomodationMy = z.infer<typeof ZAccomodationMy>
