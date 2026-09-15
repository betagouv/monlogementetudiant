import { z } from 'zod'
import { ZOwnerContactMode } from '~/enums/owner-contact-mode'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import { TYPOLOGY_TYPES } from './typology'

const ZAccommodationAddress = z.object({
  address: z.string(),
  city: z.string(),
  postalCode: z.string(),
  isMain: z.boolean(),
})

/** One typology in the keyed `typologies` object (indexed by typology type = suffix). */
export const ZTypologyView = z.object({
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  superficieMin: z.number().nullable(),
  superficieMax: z.number().nullable(),
  nbTotal: z.number().nullable(),
  nbAvailable: z.number().nullable(),
  colocation: z.boolean(),
})
export type TTypologyView = z.infer<typeof ZTypologyView>

/** Keyed typologies object: `{ t1: {...}, t3: {...} }` (only present typologies). */
export const ZTypologiesRecord = z.partialRecord(z.enum(TYPOLOGY_TYPES), ZTypologyView)
export type TTypologiesRecord = z.infer<typeof ZTypologiesRecord>

const ZBaseAccommodationInfo = z.object({
  id: z.number(),
  address: z.string().max(255),
  city: z.string(),
  citySlug: z.string().optional(),
  postalCode: z.string().max(5),
  addresses: z.array(ZAccommodationAddress).optional(),
  departmentCode: z.string().max(3).optional(),
  name: z.string().max(250),
  residenceType: z.enum(EResidenceType).nullable(),
  targetAudience: z.enum(ETargetAudience).nullable(),
  slug: z.string().max(250),
  acceptWaitingList: z.boolean(),
  imagesUrls: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  rentalChargesDetails: z.string().nullable(),
  externalUrl: z.string().optional(),
  virtualTourUrl: z.string().nullable(),
  updatedAt: z.date(),
  published: z.boolean(),
  scholarshipHoldersPriority: z.boolean(),
  socialHousingRequired: z.boolean(),
  wifi: z.boolean(),
  isImported: z.boolean().optional(),
  // Inline coordinates (replaces the GeoJSON geometry wrapper).
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

/** Denormalized aggregates kept on the parent (typology detail lives in `typologies`). */
const ZAggregates = z.object({
  nbAccessibleApartments: z.number().nullable(),
  nbColivingApartments: z.number().nullable(),
  nbTotalApartments: z.number().nullable(),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
})

const ZOwnerInfo = z.object({
  ownerName: z.string().max(150).nullable(),
  ownerUrl: z.string().max(500).nullable(),
})

const ZAmenities = z.object({
  refrigerator: z.boolean().nullable(),
  laundryRoom: z.boolean().nullable(),
  bathroom: z.enum(['private', 'shared']).nullable(),
  kitchenType: z.enum(['private', 'shared']).nullable(),
  microwave: z.boolean().nullable(),
  secureAccess: z.boolean().nullable(),
  parking: z.boolean().nullable(),
  commonAreas: z.boolean().nullable(),
  bikeStorage: z.boolean().nullable(),
  desk: z.boolean().nullable(),
  residenceManager: z.boolean().nullable(),
  cookingPlates: z.boolean().nullable(),
})

// Flat accommodation object (no more { geometry, properties } GeoJSON wrapper).
export const ZAccomodation = ZBaseAccommodationInfo.extend(ZAggregates.shape)
  .extend(ZOwnerInfo.shape)
  .extend({ typologies: ZTypologiesRecord })
export type TAccomodation = z.infer<typeof ZAccomodation>

export const ZAccomodationCard = ZAccomodation
export type TAccomodationCard = z.infer<typeof ZAccomodationCard>

export const ZAccomodationDetails = ZAccomodation.extend(ZAmenities.shape).extend({
  owner: z
    .object({
      imageBase64: z.string().nullable(),
      name: z.string().max(150),
      slug: z.string().max(250),
      url: z.string().max(500),
      landingUrl: z.string().max(500).nullable(),
      contactMode: ZOwnerContactMode,
    })
    .nullable(),
})
export type TAccomodationDetails = z.infer<typeof ZAccomodationDetails>

export const ZPrepareStudentLifeAccommodationResidence = z.object({
  typologies: ZTypologiesRecord,
  location: z.string().max(250),
})
export type TPrepareStudentLifeAccommodationResidence = z.infer<typeof ZPrepareStudentLifeAccommodationResidence>

export const ZAccomodationMy = ZAccomodation.extend(ZAmenities.shape).extend({
  isImported: z.boolean(),
  acceptsApplications: z.boolean(),
})
export type TAccomodationMy = z.infer<typeof ZAccomodationMy>
