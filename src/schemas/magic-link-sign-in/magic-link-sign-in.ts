import { z } from 'zod'

export const ZMagicLinkSignInForm = z.object({
  email: z.string().min(1, { message: 'Veuillez saisir votre email' }).email({ message: 'Veuillez saisir un email valide' }),
})

export type TMagicLinkSignInForm = z.infer<typeof ZMagicLinkSignInForm>
