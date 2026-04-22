export const PERSISTED_QUERY_PARAMS = ['ownerId'] as const

type SearchParamsLike = { get(key: string): string | null } | Record<string, string | string[] | undefined>

function read(source: SearchParamsLike, key: string): string | undefined {
  if (typeof (source as URLSearchParams).get === 'function') {
    return (source as URLSearchParams).get(key) ?? undefined
  }
  const raw = (source as Record<string, string | string[] | undefined>)[key]
  return Array.isArray(raw) ? raw[0] : raw
}

export function buildHref(
  pathname: string,
  searchParams: SearchParamsLike | null | undefined,
  overrides?: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams()

  if (searchParams) {
    for (const key of PERSISTED_QUERY_PARAMS) {
      const value = read(searchParams, key)
      if (value) params.set(key, value)
    }
  }

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value == null || value === '') params.delete(key)
    else params.set(key, String(value))
  }

  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
