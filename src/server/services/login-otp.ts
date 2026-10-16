import { loginOtpIdentifier } from '~/lib/login-otp'

/** Code de secours envoyé avec le lien : remplace le code précédent de cet email. */
export async function createLoginOtp(email: string): Promise<string> {
  const { auth } = await import('~/services/better-auth')
  const context = await auth.$context
  await context.internalAdapter.deleteVerificationByIdentifier(loginOtpIdentifier(email))
  return auth.api.createVerificationOTP({ body: { email, type: 'sign-in' } })
}
