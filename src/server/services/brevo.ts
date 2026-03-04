const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const BREVO_TEMPLATE_MAGIC_LINK = Number(process.env.BREVO_TEMPLATE_MAGIC_LINK)
const BREVO_TEMPLATE_VALIDATION = Number(process.env.BREVO_TEMPLATE_VALIDATION)
const BREVO_TEMPLATE_RESET_PASSWORD = Number(process.env.BREVO_TEMPLATE_RESET_PASSWORD)

interface TemplateEmailParams {
  to: string
  templateId: number
  params: Record<string, string>
}

export async function sendTemplateEmail({ to, templateId, params }: TemplateEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set')
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to: [{ email: to }],
      templateId,
      params,
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
    templateId: BREVO_TEMPLATE_VALIDATION,
    params: { VALIDATION_LINK: url },
  })
}

export async function sendResetPasswordEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: BREVO_TEMPLATE_RESET_PASSWORD,
    params: { RESET_LINK: url },
  })
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: BREVO_TEMPLATE_MAGIC_LINK,
    params: { MAGIC_LINK: url },
  })
}
