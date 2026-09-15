import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { owners } from './owners'

export const targetAudienceEnum = pgEnum('target_audience', [
  'etudiants',
  'mixte-etudiants-jeunes-actifs',
  'diffus-etudiants',
  'diffus-mixte-etudiants-jeunes-actifs',
])

export const accommodations = pgTable(
  'accommodation',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    description: text(),
    residenceType: varchar('residence_type', { length: 100 }),
    targetAudience: targetAudienceEnum('target_audience'),
    published: boolean().notNull(),

    // Apartment counts
    nbTotalApartments: integer('nb_total_apartments'),
    nbAccessibleApartments: integer('nb_accessible_apartments'),
    nbColivingApartments: integer('nb_coliving_apartments'),
    // Denormalized availability aggregate (NULL when every typology availability is unknown,
    // so the search ordering can keep "unknown availability" distinct from "0 available").
    nbAvailableApartments: integer('nb_available_apartments'),

    // Pricing — denormalized aggregates over the typology child rows (for the search price slider).
    // Per-typology prices/surfaces/counts/availability live in `accommodation_typology`.
    priceMin: integer('price_min'),
    priceMax: integer('price_max'),

    // Amenities
    laundryRoom: boolean('laundry_room'),
    commonAreas: boolean('common_areas'),
    bikeStorage: boolean('bike_storage'),
    parking: boolean('parking'),
    secureAccess: boolean('secure_access'),
    residenceManager: boolean('residence_manager'),
    kitchenType: varchar('kitchen_type', { length: 50 }),
    desk: boolean('desk'),
    cookingPlates: boolean('cooking_plates'),
    microwave: boolean('microwave'),
    refrigerator: boolean('refrigerator'),
    wifi: boolean('wifi'),
    bathroom: varchar('bathroom', { length: 50 }),
    acceptWaitingList: boolean('accept_waiting_list'),
    acceptsApplications: boolean('accepts_applications').notNull().default(true),
    scholarshipHoldersPriority: boolean('scholarship_holders_priority'),
    socialHousingRequired: boolean('social_housing_required'),

    // Media/URLs
    rentalChargesDetails: text('rental_charges_details'),
    imagesUrls: text('images_urls').array(),
    externalUrl: varchar('external_url', { length: 255 }),
    virtualTourUrl: text('virtual_tour_url'),
    externalReference: varchar('external_reference', { length: 255 }),

    // Relations
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    index('accommodation_owner_id_idx').on(t.ownerId),
    index('accommodation_published_idx').on(t.published),
    unique('unique_owner_external_reference').on(t.ownerId, t.externalReference),
  ],
)
