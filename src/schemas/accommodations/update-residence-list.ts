import { z } from 'zod'

export const ZUpdateResidenceList = z.object({
  nb_t1_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t1_bis_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t2_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t3_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
  nb_t4_more_available: z.number({ message: 'Le champs est requis' }).min(0).nullable(),
})

export type TUpdateResidenceList = z.infer<typeof ZUpdateResidenceList>

export const createUpdateResidenceListSchema = (existingData: {
  nb_t1?: number | null
  nb_t1_bis?: number | null
  nb_t2?: number | null
  nb_t3?: number | null
  nb_t4_more?: number | null
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
        total: existingData.nb_t4_more,
        available: data.nb_t4_more_available,
        availablePath: 'nb_t4_more_available',
        type: 'T4+',
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
