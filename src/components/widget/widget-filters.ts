export const WIDGET_FILTER_KEYS = ['ville', 'disponibilites', 'prix', 'colocation', 'crous', 'accessible'] as const
export type WidgetFilterKey = (typeof WIDGET_FILTER_KEYS)[number]

export const parseVisibleFilters = (param: string | undefined): WidgetFilterKey[] | null => {
  if (param === 'false') return null
  if (!param) return [...WIDGET_FILTER_KEYS]
  const requested = param.split(',').map((s) => s.trim())
  const filtered = WIDGET_FILTER_KEYS.filter((key) => requested.includes(key))
  return filtered.length > 0 ? filtered : null
}
