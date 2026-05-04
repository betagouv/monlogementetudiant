import { env } from '~/server/env'

interface TemplateEmailParams {
  to: string
  templateId: number
  params?: Record<string, string>
}

export async function sendTemplateEmail({ to, templateId, params }: TemplateEmailParams): Promise<void> {
  const response = await fetch(env.BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to: [{ email: to }],
      templateId,
      ...(params && { params }),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo email failed: ${response.status} ${error}`)
  }
}

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_VALIDATION,
    params: { VALIDATION_LINK: url },
  })
}

export async function sendResetPasswordEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_RESET_PASSWORD,
    params: { RESET_LINK: url },
  })
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_MAGIC_LINK,
    params: { MAGIC_LINK: url },
  })
}

export async function sendOwnerAccountActivated(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_MAGIC_LINK,
    params: { MAGIC_LINK: url },
  })
}

export async function sendOwnerWelcomeEmail(email: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_OWNER_WELCOME,
  })
}
