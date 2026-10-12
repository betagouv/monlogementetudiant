const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f]')

/** Chemin interne commençant par `prefix`, sinon `null` : jamais d'URL absolue ni protocol-relative. */
export const safeCallbackPath = (value: unknown, prefix = '/'): string | null => {
  if (typeof value !== 'string' || !value.startsWith('/') || !value.startsWith(prefix)) return null
  if (value.startsWith('//') || value.includes('\\') || CONTROL_CHARS.test(value)) return null
  return value
}
