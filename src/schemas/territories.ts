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
  averageIncome: z.number(),
  averageRent: z.number(),
  epciCode: z.string(),
  id: z.number(),
  inseeCodes: z.array(z.string()),
  name: z.string(),
  nbTotalApartments: z.number(),
  nbStudents: z.number(),
  nearbyCities: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
    }),
  ),
  nbT1: z.number().nullable(),
  nbT1Bis: z.number().nullable(),
  nbT2: z.number().nullable(),
  nbT3: z.number().nullable(),
  nbT4: z.number().nullable(),
  nbT5: z.number().nullable(),
  nbT6: z.number().nullable(),
  nbT7More: z.number().nullable(),
  popular: z.boolean(),
  postalCodes: z.array(z.string()),
  priceMin: z.number().nullable(),
  slug: z.string(),
  departmentCode: z.string(),
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
