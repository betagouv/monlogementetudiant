import { z } from 'zod'

const documentSchema = z.object({
  id: z.number(),
  documentCategory: z.string(),
  documentSubCategory: z.string().optional(),
  documentStatus: z.string(),
  monthlySum: z.number().optional(),
  customText: z.string().optional(),
  name: z.string().optional(),
})

const guarantorSchema = z.object({
  id: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  typeGuarantor: z.enum(['NATURAL_PERSON', 'LEGAL_PERSON', 'ORGANISM']),
  documents: z.array(documentSchema).default([]),
})

const coTenantSchema = z.object({
  id: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string(),
  tenantType: z.enum(['CREATE', 'JOIN']),
  status: z.enum(['TO_PROCESS', 'VALIDATED', 'DECLINED', 'INCOMPLETE', 'ARCHIVED']),
  documents: z.array(documentSchema).default([]),
  guarantors: z.array(guarantorSchema).default([]),
  franceConnect: z.boolean(),
})

const apartmentSharingSchema = z.object({
  id: z.number(),
  applicationType: z.enum(['ALONE', 'COUPLE', 'GROUP']),
  dossierUrl: z.string().optional(),
  dossierPdfUrl: z.string().optional(),
  status: z.enum(['TO_PROCESS', 'VALIDATED', 'DECLINED', 'INCOMPLETE', 'ARCHIVED']),
  tenants: z.array(coTenantSchema),
})

export const ZConnectedTenantSchema = z.object({
  connectedTenantId: z.number(),
  apartmentSharing: apartmentSharingSchema,
})

export type TConnectedTenant = z.infer<typeof ZConnectedTenantSchema>
