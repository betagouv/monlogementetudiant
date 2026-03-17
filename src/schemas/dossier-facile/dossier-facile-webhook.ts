import { z } from 'zod'

const webhookDocumentSchema = z.object({
  documentCategory: z.string(),
  documentSubCategory: z.string().nullish(),
  documentStatus: z.string().nullish(),
  name: z.string().nullish(),
})

const webhookGuarantorSchema = z.object({
  documents: z.array(webhookDocumentSchema).default([]),
})

const webhookTenantSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  documents: z.array(webhookDocumentSchema).default([]),
  guarantors: z.array(webhookGuarantorSchema).default([]),
})

export const ZWebhookBodySchema = z.object({
  partnerCallBackType: z.string(),
  onTenantId: z.union([z.string(), z.number()]).transform(String),
  status: z.string().optional(),
  dossierUrl: z.string().nullish(),
  dossierPdfUrl: z.string().nullish(),
  tenants: z.array(webhookTenantSchema).default([]),
})

export type TWebhookBody = z.infer<typeof ZWebhookBodySchema>
