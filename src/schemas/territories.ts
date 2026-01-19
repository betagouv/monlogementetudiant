import { z } from 'zod'

export const ZBbox = z.object({
  bbox: z.object({
    xmax: z.number(),
    xmin: z.number(),
    ymax: z.number(),
    ymin: z.number(),
  }),
})

const ZAcademyOrDepartment = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  ...ZBbox.shape,
})

const ZCity = z.object({
  average_income: z.number(),
  average_rent: z.number(),
  epci_code: z.string(),
  id: z.number(),
  insee_codes: z.array(z.string()),
  name: z.string(),
  nb_total_apartments: z.number(),
  nb_students: z.number(),
  nearby_cities: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
    }),
  ),
  nb_t1: z.number().nullable(),
  nb_t1_bis: z.number().nullable(),
  nb_t2: z.number().nullable(),
  nb_t3: z.number().nullable(),
  nb_t4: z.number().nullable(),
  nb_t5: z.number().nullable(),
  nb_t6: z.number().nullable(),
  nb_t7_more: z.number().nullable(),
  popular: z.boolean(),
  postal_codes: z.array(z.string()),
  price_min: z.number().nullable(),
  slug: z.string(),
  department_code: z.string(),
  ...ZBbox.shape,
})

export type TAcademyOrDepartment = z.infer<typeof ZAcademyOrDepartment>
export type TCity = z.infer<typeof ZCity>
export type TTerritory = TAcademyOrDepartment | TCity

export const ZTerritories = z.object({
  academies: z.array(ZAcademyOrDepartment),
  cities: z.array(ZCity),
  departments: z.array(ZAcademyOrDepartment),
})

export type TTerritories = z.infer<typeof ZTerritories>

export const ZRentSearchResult = z.object({
  city: z.string(),
  rentPerM2: z.number(),
  rentFor20M2: z.number(),
})

export const ZRentSearchResponse = z.object({
  cities: z.array(ZRentSearchResult),
  total: z.number(),
})

export type TRentSearchResult = z.infer<typeof ZRentSearchResult>
export type TRentSearchResponse = z.infer<typeof ZRentSearchResponse>
