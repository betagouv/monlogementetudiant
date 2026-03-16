export const EXPANDED_SEARCH_RADIUS_KM = 10
export const EXPANDED_SEARCH_PAGE_SIZE = 24
export const EXPANDED_SEARCH_BUDGET_FACTOR = 1.25

export const computeExpandedPriceMax = (priceMax?: number | null) => {
  if (typeof priceMax !== 'number' || !Number.isFinite(priceMax)) {
    return undefined
  }

  return Math.round(priceMax * EXPANDED_SEARCH_BUDGET_FACTOR)
}
