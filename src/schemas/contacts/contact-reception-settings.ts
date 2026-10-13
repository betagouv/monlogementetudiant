import { z } from 'zod'

const MAX_RESIDENCES = 2000
const MAX_MANAGERS = 200

export const ZSaveContactReceptionSettings = z.object({
  ownerId: z.number().optional(),
  residences: z
    .array(
      z.object({
        accommodationId: z.number().int().positive(),
        managerIds: z.array(z.string().min(1)).max(MAX_MANAGERS),
        acceptWaitingList: z.boolean(),
      }),
    )
    .min(1, { message: 'Sélectionnez au moins une résidence' })
    .max(MAX_RESIDENCES),
})

export type TSaveContactReceptionSettings = z.infer<typeof ZSaveContactReceptionSettings>

const ZReceptionManager = z.object({ id: z.string().min(1), name: z.string() })

export type TReceptionManager = z.infer<typeof ZReceptionManager>

export const zContactReceptionSettingsForm = ({ requireManagers }: { requireManagers: boolean }) =>
  z.object({
    residences: z
      .array(
        z.object({
          accommodationId: z.number().int().positive(),
          managers: requireManagers
            ? z.array(ZReceptionManager).min(1, { message: 'Sélectionnez au moins un gestionnaire' })
            : z.array(ZReceptionManager),
          acceptWaitingList: z.boolean(),
        }),
      )
      .min(1, { message: 'Sélectionnez au moins une résidence' }),
  })

export type TContactReceptionSettingsForm = z.infer<ReturnType<typeof zContactReceptionSettingsForm>>
