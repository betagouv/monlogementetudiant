export function getFaviconUrl(url: string): string | null {
  try {
    const origin = new URL(url).origin
    return `${origin}/favicon.ico`
  } catch {
    return null
  }
}
