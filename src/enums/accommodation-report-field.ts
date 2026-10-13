import { z } from 'zod'

export enum EAccommodationReportField {
  AVAILABILITY = 'availability',
  PRICE = 'price',
  OTHER = 'other',
}

export const ZAccommodationReportField = z.enum(EAccommodationReportField)

export const ACCOMMODATION_REPORT_FIELD_LABELS: Record<EAccommodationReportField, string> = {
  [EAccommodationReportField.AVAILABILITY]: 'Disponibilité du logement',
  [EAccommodationReportField.PRICE]: 'Prix',
  [EAccommodationReportField.OTHER]: 'Autre',
}
