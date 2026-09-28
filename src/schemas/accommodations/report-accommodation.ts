import { z } from 'zod'
import { EAccommodationReportField, ZAccommodationReportField } from '~/enums/accommodation-report-field'

export const REPORT_DETAILS_MAX_LENGTH = 1000

export const ZReportAccommodationForm = z.object({
  field: ZAccommodationReportField,
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX_LENGTH, { message: `Les précisions ne doivent pas dépasser ${REPORT_DETAILS_MAX_LENGTH} caractères` })
    .optional(),
})
export type TReportAccommodationForm = z.infer<typeof ZReportAccommodationForm>

export const ZReportAccommodation = ZReportAccommodationForm.extend({ slug: z.string().min(1) })
export type TReportAccommodation = z.infer<typeof ZReportAccommodation>

export const reportAccommodationFormDefaults: TReportAccommodationForm = {
  field: EAccommodationReportField.AVAILABILITY,
  details: '',
}
