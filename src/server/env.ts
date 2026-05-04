import { z } from 'zod'

const envSchema = z.object({
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  BREVO_API_URL: z.url().default('https://api.brevo.com/v3/smtp/email'),
  // accepts only entire positive numbers for the brevo templates.
  BREVO_TEMPLATE_MAGIC_LINK: z.coerce.number().int().positive().default(2),
  BREVO_TEMPLATE_VALIDATION: z.coerce.number().int().positive().default(21),
  BREVO_TEMPLATE_RESET_PASSWORD: z.coerce.number().int().positive().default(23),
  BREVO_TEMPLATE_OWNER_WELCOME: z.coerce.number().int().positive().default(40),
})

export const env = envSchema.parse(process.env)
