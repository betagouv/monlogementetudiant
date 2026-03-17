import { z } from 'zod'

export const ZOwnerFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  url: z.url('URL invalide').or(z.literal('')).optional(),
  acceptDossierFacileApplications: z.boolean(),
})

export type TOwnerFormData = z.infer<typeof ZOwnerFormSchema>
