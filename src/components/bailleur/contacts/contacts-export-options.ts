import { getRegionByDepartmentCode } from '~/utils/french-regions'

const EXPORT_PATH = '/api/bailleur/contacts/export'

export const buildContactsExportHref = ({ ownerId, region, residence }: { ownerId?: number; region?: string; residence?: string }) => {
  const params = new URLSearchParams()
  if (ownerId) params.set('ownerId', String(ownerId))
  if (residence) params.set('residence', residence)
  else if (region) params.set('region', region)
  const query = params.toString()
  return query ? `${EXPORT_PATH}?${query}` : EXPORT_PATH
}

export const exportRegionOptions = (residences: { departmentCode: string | null }[]): string[] =>
  [...new Set(residences.map((r) => getRegionByDepartmentCode(r.departmentCode)).filter((r): r is string => r !== null))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )
