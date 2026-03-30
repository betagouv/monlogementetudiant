import { bigint, boolean, geometry, index, integer, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { cities } from './cities'
import { owners } from './owners'

export const accommodations = pgTable(
  'accommodation_accommodation',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    description: text(),
    address: varchar({ length: 255 }),
    postalCode: varchar('postal_code', { length: 5 }).notNull(),
    residenceType: varchar('residence_type', { length: 100 }),
    target_audience: varchar('target_audience', { length: 100 }),
    published: boolean().notNull(),
    available: boolean().notNull().default(true),
    geom: geometry({ type: 'point', srid: 4326 }),

    // Apartment counts
    nbTotalApartments: integer('nb_total_apartments'),
    nbAccessibleApartments: integer('nb_accessible_apartments'),
    nbColivingApartments: integer('nb_coliving_apartments'),
    nbT1: integer('nb_t1'),
    nbT1Bis: integer('nb_t1_bis'),
    nbT2: integer('nb_t2'),
    nbT3: integer('nb_t3'),
    nbT4: integer('nb_t4'),
    nbT5: integer('nb_t5'),
    nbT6: integer('nb_t6'),
    nbT7More: integer('nb_t7_more'),

    // Availability
    nbT1Available: integer('nb_t1_available'),
    nbT1BisAvailable: integer('nb_t1_bis_available'),
    nbT2Available: integer('nb_t2_available'),
    nbT3Available: integer('nb_t3_available'),
    nbT4Available: integer('nb_t4_available'),
    nbT5Available: integer('nb_t5_available'),
    nbT6Available: integer('nb_t6_available'),
    nbT7MoreAvailable: integer('nb_t7_more_available'),

    // Pricing
    priceMin: integer('price_min'),
    priceMinT1: integer('price_min_t1'),
    priceMaxT1: integer('price_max_t1'),
    priceMinT1Bis: integer('price_min_t1_bis'),
    priceMaxT1Bis: integer('price_max_t1_bis'),
    priceMinT2: integer('price_min_t2'),
    priceMaxT2: integer('price_max_t2'),
    priceMinT3: integer('price_min_t3'),
    priceMaxT3: integer('price_max_t3'),
    priceMinT4: integer('price_min_t4'),
    priceMaxT4: integer('price_max_t4'),
    priceMinT5: integer('price_min_t5'),
    priceMaxT5: integer('price_max_t5'),
    priceMinT6: integer('price_min_t6'),
    priceMaxT6: integer('price_max_t6'),
    priceMinT7More: integer('price_min_t7_more'),
    priceMaxT7More: integer('price_max_t7_more'),

    // Superficie (m²)
    superficieMinT1: integer('superficie_min_t1'),
    superficieMaxT1: integer('superficie_max_t1'),
    superficieMinT1Bis: integer('superficie_min_t1_bis'),
    superficieMaxT1Bis: integer('superficie_max_t1_bis'),
    superficieMinT2: integer('superficie_min_t2'),
    superficieMaxT2: integer('superficie_max_t2'),
    superficieMinT3: integer('superficie_min_t3'),
    superficieMaxT3: integer('superficie_max_t3'),
    superficieMinT4: integer('superficie_min_t4'),
    superficieMaxT4: integer('superficie_max_t4'),
    superficieMinT5: integer('superficie_min_t5'),
    superficieMaxT5: integer('superficie_max_t5'),
    superficieMinT6: integer('superficie_min_t6'),
    superficieMaxT6: integer('superficie_max_t6'),
    superficieMinT7More: integer('superficie_min_t7_more'),
    superficieMaxT7More: integer('superficie_max_t7_more'),

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
    scholarshipHoldersPriority: boolean('scholarship_holders_priority'),

    // Media/URLs
    imagesUrls: text('images_urls').array(),
    imagesCount: integer('images_count').notNull(),
    externalUrl: varchar('external_url', { length: 255 }),
    externalReference: varchar('external_reference', { length: 255 }),

    // Relations
    cityId: bigint('city_id', { mode: 'number' }).references(() => cities.id),
    ownerId: bigint('owner_id', { mode: 'number' }).references(() => owners.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    index('accommodation_city_id_idx').on(t.cityId),
    index('accommodation_owner_id_idx').on(t.ownerId),
    index('accommodation_published_idx').on(t.published),
    unique('unique_owner_external_reference').on(t.ownerId, t.externalReference),
  ],
)
