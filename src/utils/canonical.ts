import { env } from '~/server/env'

export function getCanonicalUrl(path: string = '') {
  const baseUrl = env.BASE_URL
  const normalizedPath = path.startsWith('/') ? path : path ? `/${path}` : ''
  return `${baseUrl}${normalizedPath}`
}

export function getDefaultOgImage() {
  return [{ url: getCanonicalUrl('/images/cover.jpg'), width: 1200, height: 630 }]
}
