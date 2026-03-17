import type { TWebhookBody } from '~/schemas/dossier-facile/dossier-facile-webhook'
import { normalizeStatus } from './sync'

export interface WebhookDocument {
  ownerType: 'tenant' | 'guarantor'
  documentCategory: string
  documentSubCategory: string | null
  documentStatus: string | null
  url: string | null
}

export interface WebhookData {
  status: string | null
  url: string | null
  pdfUrl: string | null
  name: string | null
  guarantorCount: number
  documents: WebhookDocument[]
}

export function extractWebhookData(body: TWebhookBody): WebhookData {
  const status = normalizeStatus(body.status) ?? normalizeStatus(body.partnerCallBackType)
  const url = body.dossierUrl ?? null
  const pdfUrl = body.dossierPdfUrl ?? null

  const firstTenant = body.tenants[0]

  let name: string | null = null
  const documents: WebhookDocument[] = []

  if (firstTenant) {
    const fullName = [firstTenant.firstName, firstTenant.lastName].filter(Boolean).join(' ')
    if (fullName) name = fullName

    for (const doc of firstTenant.documents) {
      documents.push({
        ownerType: 'tenant',
        documentCategory: doc.documentCategory,
        documentSubCategory: doc.documentSubCategory ?? null,
        documentStatus: doc.documentStatus ?? null,
        url: doc.name ?? null,
      })
    }

    for (const guarantor of firstTenant.guarantors) {
      for (const doc of guarantor.documents) {
        documents.push({
          ownerType: 'guarantor',
          documentCategory: doc.documentCategory,
          documentSubCategory: doc.documentSubCategory ?? null,
          documentStatus: doc.documentStatus ?? null,
          url: doc.name ?? null,
        })
      }
    }
  }

  return {
    status,
    url,
    pdfUrl,
    name,
    guarantorCount: firstTenant?.guarantors.length ?? 0,
    documents,
  }
}
