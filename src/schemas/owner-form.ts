import { z } from 'zod'

export const ownerFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  url: z.string().url('URL invalide').or(z.literal('')).optional(),
})

export type OwnerFormData = z.infer<typeof ownerFormSchema>
