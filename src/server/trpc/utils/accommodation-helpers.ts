import slugify from 'slugify'

slugify.extend({
  '&': 'et',
  "'": '-',
  '\u2019': '-',
  ' : ': '-',
  ':': '-',
  '"': '',
  '.': '-',
  '\u275D': '',
  '\u275E': '',
  '\u201C': '',
  '\u201D': '',
  '\u00AB': '',
  '\u00BB': '',
  '(': '',
  ')': '',
  '[': '',
  ']': '',
  '{': '',
  '}': '',
  '\u00BF': '',
  '?': '',
  '!': '',
  '/': '',
  '\\': '',
  ',': '-',
  ';': '-',
  '<': '',
  '>': '',
  '@': '-',
  '*': '',
  '+': ' plus ',
})

export function generateSlug(name: string): string {
  return slugify(name, { lower: true })
}

export function computeDerivedFields(data: {
  nb_t1?: number | null
  nb_t1_bis?: number | null
  nb_t2?: number | null
  nb_t3?: number | null
  nb_t4?: number | null
  nb_t5?: number | null
  nb_t6?: number | null
  nb_t7_more?: number | null
  price_min_t1?: number | null
  price_min_t1_bis?: number | null
  price_min_t2?: number | null
  price_min_t3?: number | null
  price_min_t4?: number | null
  price_min_t5?: number | null
  price_min_t6?: number | null
  price_min_t7_more?: number | null
  images_urls?: string[] | null
}) {
  const counts = [data.nb_t1, data.nb_t1_bis, data.nb_t2, data.nb_t3, data.nb_t4, data.nb_t5, data.nb_t6, data.nb_t7_more].filter(
    (v): v is number => v != null,  
  )

  const nbTotalApartments = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : null

  const prices = [
    data.price_min_t1,
    data.price_min_t1_bis,
    data.price_min_t2,
    data.price_min_t3,
    data.price_min_t4,
    data.price_min_t5,
    data.price_min_t6,
    data.price_min_t7_more,
  ].filter((v): v is number => v != null && v > 0)

  const priceMin = prices.length > 0 ? Math.min(...prices) : null

  const imagesCount = data.images_urls?.length ?? 0

  return { nbTotalApartments, priceMin, imagesCount }
}

export async function geocodeAddress(address: string, city: string, postalCode: string): Promise<{ lon: number; lat: number } | null> {
  const query = `${address} ${postalCode} ${city}`
  const baseUrl = process.env.GEOCODING_API_URL ?? 'https://data.geopf.fr/geocodage/search'
  const url = `${baseUrl}?q=${encodeURIComponent(query)}&limit=1`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    const feature = data?.features?.[0]
    if (!feature?.geometry?.coordinates) return null

    const [lon, lat] = feature.geometry.coordinates
    return { lon, lat }
  } catch {
    return null
  }
}
