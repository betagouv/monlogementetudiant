import { bigint, boolean, geometry, integer, pgTable, varchar } from 'drizzle-orm/pg-core'

export const accommodations = pgTable('accommodation_accommodation', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  city: varchar({ length: 150 }).notNull(),
  postalCode: varchar('postal_code', { length: 5 }).notNull(),
  published: boolean().notNull(),
  available: boolean().notNull(),
  geom: geometry({ type: 'point', srid: 4326 }),
  nbTotalApartments: integer('nb_total_apartments'),
  nbT1: integer('nb_t1'),
  nbT1Bis: integer('nb_t1_bis'),
  nbT2: integer('nb_t2'),
  nbT3: integer('nb_t3'),
  nbT4: integer('nb_t4'),
  nbT5: integer('nb_t5'),
  nbT6: integer('nb_t6'),
  nbT7More: integer('nb_t7_more'),
  priceMin: integer('price_min'),
  imagesCount: integer('images_count').notNull(),
})
