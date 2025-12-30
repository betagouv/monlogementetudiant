import { z } from 'zod'

export const ZCredentialsSignInForm = z.object({
  email: z.string().min(1, { message: 'Veuillez saisir votre email' }).email({ message: 'Veuillez saisir un email valide' }),
  password: z.string().min(1, { message: 'Veuillez saisir votre mot de passe' }),
})

export type TCredentialsSignInForm = z.infer<typeof ZCredentialsSignInForm>
