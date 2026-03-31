import { z } from 'zod'

export function getCanonicalUrl(path: string = '') {
  const baseUrl = z.string().parse(process.env.BASE_URL)
  const normalizedPath = path.startsWith('/') ? path : path ? `/${path}` : ''
  return `${baseUrl}${normalizedPath}`
}
