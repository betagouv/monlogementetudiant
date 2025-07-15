import { z } from 'zod'

export enum EResidence {
  autre = 'Autre',
  ecole = "Résidence d'école",
  'foyer-soleil' = 'Foyer soleil',
  'hoteliere-sociale' = 'Résidence Hôtelière à vocation sociale',
  intergenerationnelle = 'Résidence intergénérationnelle',
  internat = 'Internat',
  'jeunes-travailleurs' = 'Résidence jeunes travailleurs',
  'mixte-actifs-etudiants' = 'Résidence mixte jeunes actifs/étudiants',
  'service-logement' = 'Service logement',
  'service-universitaire-privee' = 'Résidence service / Résidence universitaire privée',
  'sociale-jeunes-actifs' = 'Résidence sociale jeunes actifs',
  'u-crous' = 'Cité U / résidence traditionnelle CROUS',
  'universitaire-conventionnee' = 'Résidence Universitaire conventionnée',
}

export const ZGeometry = z.object({
  coordinates: z.array(z.number()),
  type: z.string(),
})

export const ZAccomodation = z.object({
  geometry: ZGeometry,
  id: z.number(),
  properties: z.object({
    address: z.string().max(255),
    city: z.string().max(150),
    images_urls: z.array(z.string()).nullable(),
    name: z.string().max(250),
    nb_accessible_apartments: z.number().nullable(),
    nb_coliving_apartments: z.number().nullable(),
    nb_t1_available: z.number().nullable(),
    nb_t1_bis_available: z.number().nullable(),
    nb_t2_available: z.number().nullable(),
    nb_t3_available: z.number().nullable(),
    nb_t4_more_available: z.number().nullable(),
    nb_t1: z.number().nullable(),
    nb_t1_bis: z.number().nullable(),
    nb_t2: z.number().nullable(),
    nb_t3: z.number().nullable(),
    nb_t4_more: z.number().nullable(),
    nb_total_apartments: z.number().nullable(),
    owner_name: z.string().max(150).nullable(),
    owner_url: z.string().max(500).nullable(),
    postal_code: z.string().max(5),
    price_min: z.number().nullable(),
    residence_type: z.nativeEnum(EResidence),
    slug: z.string().max(250),
  }),
})

export type TAccomodation = z.infer<typeof ZAccomodation>

export const ZAccomodationCard = ZAccomodation.pick({ id: true, properties: true })
export type TAccomodationCard = z.infer<typeof ZAccomodationCard>

enum AccommodationHouseRoomType {
  private = 'private',
  shared = 'shared',
}

export const ZAccomodationDetails = z.object({
  available: z.boolean(),
  address: z.string().max(255),
  bathroom: z.nativeEnum(AccommodationHouseRoomType),
  bike_storage: z.boolean().nullable(),
  city: z.string().max(150),
  common_areas: z.boolean().nullable(),
  cooking_plates: z.boolean().nullable(),
  desk: z.boolean().nullable(),
  geom: ZGeometry,
  images_urls: z.array(z.string()).nullable(),
  kitchen_type: z.nativeEnum(AccommodationHouseRoomType),
  laundry_room: z.boolean().nullable(),
  microwave: z.boolean().nullable(),
  name: z.string().max(250),
  nb_accessible_apartments: z.number().nullable(),
  nb_coliving_apartments: z.number().nullable(),
  nb_t1: z.number().nullable(),
  nb_t1_available: z.number().nullable(),
  nb_t1_bis: z.number().nullable(),
  nb_t1_bis_available: z.number().nullable(),
  nb_t2: z.number().nullable(),
  nb_t2_available: z.number().nullable(),
  nb_t3: z.number().nullable(),
  nb_t3_available: z.number().nullable(),
  nb_t4_more: z.number().nullable(),
  nb_t4_more_available: z.number().nullable(),
  nb_total_apartments: z.number().nullable(),
  owner: z
    .object({
      image_base64: z.string().nullable(),
      name: z.string().max(150),
      slug: z.string().max(250),
      url: z.string().max(500),
    })
    .nullable(),
  parking: z.boolean().nullable(),
  postal_code: z.string().max(5),
  price_max: z.number().nullable(),
  price_max_t1: z.number().nullable(),
  price_max_t1_bis: z.number().nullable(),
  price_max_t2: z.number().nullable(),
  price_max_t3: z.number().nullable(),
  price_max_t4_more: z.number().nullable(),
  price_min: z.number().nullable(),
  price_min_t1: z.number().nullable(),
  price_min_t1_bis: z.number().nullable(),
  price_min_t2: z.number().nullable(),
  price_min_t3: z.number().nullable(),
  price_min_t4_more: z.number().nullable(),
  refrigerator: z.boolean().nullable(),
  residence_manager: z.boolean().nullable(),
  residence_type: z.nativeEnum(EResidence),
  secure_access: z.boolean().nullable(),
  slug: z.string().max(250),
  external_url: z.string().optional(),
})
export type TAccomodationDetails = z.infer<typeof ZAccomodationDetails>

export const ZPrepareStudentLifeAccommodationResidence = ZAccomodationDetails.pick({
  nb_t1: true,
  nb_t1_bis: true,
  nb_t2: true,
  nb_t3: true,
  nb_t4_more: true,
}).extend({
  location: z.string().max(250),
})
export type TPrepareStudentLifeAccommodationResidence = z.infer<typeof ZPrepareStudentLifeAccommodationResidence>
