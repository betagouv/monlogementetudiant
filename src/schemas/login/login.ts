import { z } from 'zod'

export const ZLoginForm = z.object({
  email: z.string().min(1, { message: 'Veuillez saisir votre email' }).email({ message: 'Veuillez saisir un email valide' }),
})

export type TLoginForm = z.infer<typeof ZLoginForm>
