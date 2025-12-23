import { z } from 'zod'

export const ZUpdateResidenceList = z.object({
  nb_t1_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t1_bis_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t2_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t3_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t4_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t5_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t6_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t7_more_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
})

export type TUpdateResidenceList = z.infer<typeof ZUpdateResidenceList>

export const createUpdateResidenceListSchema = (existingData: {
  nb_t1?: number | null
  nb_t1_bis?: number | null
  nb_t2?: number | null
  nb_t3?: number | null
  nb_t4?: number | null
  nb_t5?: number | null
  nb_t6?: number | null
  nb_t7_more?: number | null
}) =>
  ZUpdateResidenceList.superRefine((data, ctx) => {
    const validations = [
      {
        total: existingData.nb_t1,
        available: data.nb_t1_available,
        availablePath: 'nb_t1_available',
        type: 'T1',
      },
      {
        total: existingData.nb_t1_bis,
        available: data.nb_t1_bis_available,
        availablePath: 'nb_t1_bis_available',
        type: 'T1 bis',
      },
      {
        total: existingData.nb_t2,
        available: data.nb_t2_available,
        availablePath: 'nb_t2_available',
        type: 'T2',
      },
      {
        total: existingData.nb_t3,
        available: data.nb_t3_available,
        availablePath: 'nb_t3_available',
        type: 'T3',
      },
      {
        total: existingData.nb_t4,
        available: data.nb_t4_available,
        availablePath: 'nb_t4_available',
        type: 'T4',
      },
      {
        total: existingData.nb_t5,
        available: data.nb_t5_available,
        availablePath: 'nb_t5_available',
        type: 'T5',
      },
      {
        total: existingData.nb_t6,
        available: data.nb_t6_available,
        availablePath: 'nb_t6_available',
        type: 'T6',
      },
      {
        total: existingData.nb_t7_more,
        available: data.nb_t7_more_available,
        availablePath: 'nb_t7_more_available',
        type: 'T7+',
      },
    ]

    for (const { total, available, availablePath, type } of validations) {
      if (total !== null && total !== undefined && available !== null && available !== undefined) {
        if (available > total) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Le nombre de logements ${type} disponibles ne peut pas être supérieur au nombre total (${total})`,
            path: [availablePath],
          })
        }
      }
    }
  })
